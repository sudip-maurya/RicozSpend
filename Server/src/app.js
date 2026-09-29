const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const rateLimit = require("./middleware/rateLimit");

const app = express();

// Security headers
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

// CORS origin whitelist
const allowedOrigins = String(process.env.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0) {
        return callback(null, true);
      }

      return callback(null, allowedOrigins.includes(origin.replace(/\/+$/, "")));
    },
    credentials: false,
  })
);

// JSON body limit
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || "3mb" }));

// Validate JWT secret
try {
  require("./utils/token").getJwtSecret();
} catch (error) {
  console.error(`[server] FATAL: ${error.message}`);
  process.exit(1);
}

// Rate limiting
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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

const dashboardRoutes = require("./routes/dashboardRoutes");
app.use("/api/dashboard", dashboardRoutes);

const transactionRoutes = require("./routes/transactionRoutes");
app.use("/api/transactions", transactionRoutes);

const analyticsRoutes = require("./routes/analyticsRoutes");
app.use("/api/analytics", analyticsRoutes);

const budgetRoutes = require("./routes/budgetRoutes");
app.use("/api/budgets", budgetRoutes);

const insightsRoutes = require("./routes/insightsRoutes");
app.use("/api/insights", insightsRoutes);

const alertRulesRoutes = require("./routes/alertRulesRoutes");
app.use("/api/alert-rules", alertRulesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Resource not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error("[server] Unhandled error:", error.message);

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON in request body." });
  }

  if (error.type === "entity.too.large") {
    return res
      .status(400)
      .json({ message: "Request body too large. CSV imports are limited to 2 MB." });
  }

  return res.status(500).json({ message: "Something went wrong. Please try again." });
});

module.exports = app;
