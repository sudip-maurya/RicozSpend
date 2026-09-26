const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const rateLimit = require("./middleware/rateLimit");

const app = express();

/* ------------------------- P1-2: security headers -------------------------
 * Dependency-free equivalent of helmet's core headers. HSTS is only sent in
 * production (it is meaningless - and harmful - over plain HTTP in dev).
 */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

/* --------------------- P1-2: CORS origin whitelist ------------------------
 * Allowed origins come from CLIENT_URL (comma-separated). With none
 * configured we fall back to permissive mode for local development.
 */
const allowedOrigins = String(process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: false,
  })
);

/* ----------------- P0-1: JSON body limit fits the CSV import -------------
 * The CSV import documents a 2 MB cap (utils/csvParser.js MAX_CSV_LENGTH) and
 * the client enforces it, but express.json() defaulted to ~100 KB - any CSV
 * between 100 KB and 2 MB died with a 413 that surfaced as a generic 500.
 * The limit is configurable via JSON_BODY_LIMIT.
 */
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "3mb" }));

/* ---------------- P2-9: fail fast when JWT auth is unconfigured -----------
 * Previously the app booted fine without JWT_SECRET and only failed at
 * runtime (500 on the first auth call). Surface the misconfiguration now.
 */
try {
  require("./utils/token").getJwtSecret();
} catch (error) {
  console.error(`[server] FATAL: ${error.message}`);
  process.exit(1);
}

/* ----------------- P1-1: rate limiting (sliding window) ------------------
 * Throttles brute-force and abuse traffic. Login/signup get stricter caps
 * than the general auth group; CSV import gets its own per-minute cap.
 */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, name: "auth" });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: "login" });
const signupLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, name: "signup" });
const importLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, name: "import" });

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/signup", signupLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/transactions/import", importLimiter);

app.get("/", (req, res) => {
  res.json({
    message: "RicozSpend Backend is Running"
  });
});

// Part 2 - authentication & user management
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Part 3 - dashboard & spend overview
const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

// Part 4 - spend / transaction management
const transactionRoutes = require("./routes/transactionRoutes");
app.use("/api/transactions", transactionRoutes);

// Part 6 - spend analysis & charts
const analyticsRoutes = require("./routes/analyticsRoutes");
app.use("/api/analytics", analyticsRoutes);

// Part 9 - budget vs actual (planned budgets + actual spend from transactions)
const budgetRoutes = require("./routes/budgetRoutes");
app.use("/api/budgets", budgetRoutes);

// Part 14 - Alerts & Insights Center (rule-based, reuses analytics/budget data)
const insightsRoutes = require("./routes/insightsRoutes");
app.use("/api/insights", insightsRoutes);

// Part 15 - Admin-configurable alert rules (Alerts Center -> Alert Rules editor, Admin only)
const alertRulesRoutes = require("./routes/alertRulesRoutes");
app.use("/api/alert-rules", alertRulesRoutes);

// Unknown route -> clean JSON 404 (instead of an HTML stack page)
app.use((req, res) => {
  res.status(404).json({ message: "Resource not found" });
});

// Central error handler: keeps stack traces / internals away from the client
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error("[server] Unhandled error:", error.message);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body." });
  }

  // P0-1: a CSV (or any JSON body) over the configured limit used to surface
  // as a misleading generic 500 - answer with a clear 400 instead.
  if (error.type === "entity.too.large") {
    return res
      .status(400)
      .json({ message: "Request body too large. CSV imports are limited to 2 MB." });
  }

  return res.status(500).json({ message: "Something went wrong. Please try again." });
});

module.exports = app;
