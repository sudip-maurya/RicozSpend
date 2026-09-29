const path = require("path");
const dotenv = require("dotenv");

// Load Server/.env exactly like server.js does
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// P3-3: these scripts write/delete data - refuse to run against production unless explicitly forced
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to run this verification script with NODE_ENV=production (pass --force to override).");
  process.exit(1);
}

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

const { ROLES } = User;

const PORT = Number(process.env.VERIFY_PORT || 5099);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const RUN_ID = Date.now();
const TEST_DOMAIN = "ricozspend.test";

/** Emails created by this run - used to clean up Atlas afterwards. */
const createdEmails = [];

const testEmail = (label) => {
  const email = `verify.${label}.${RUN_ID}@${TEST_DOMAIN}`;
  createdEmails.push(email);
  return email;
};

let passed = 0;
const failures = [];

const check = (label, condition, details) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${details ? ` -> ${details}` : ""}`);
  }
};

const section = (title) => console.log(`\n=== ${title} ===`);

const api = async (method, endpoint, { body, token } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
};

const hasPasswordField = (payload) =>
  Boolean(payload && typeof payload === "object" && Object.prototype.hasOwnProperty.call(payload, "password"));

/** Pull the raw token out of a .../verify-email?token=... link. */
const tokenFromUrl = (url) => {
  if (typeof url !== "string") return null;

  const match = url.match(/[?&]token=([^&]+)/);

  return match ? decodeURIComponent(match[1]) : null;
};

const main = async () => {
  // Force test mode for this run only
  process.env.NODE_ENV = "test";

  console.log("RicozSpend Part 2 - authentication verification");
  console.log(`Target: ${BASE_URL} (Atlas database via existing MONGO_URI)`);

  await connectDB();

  const server = app.listen(PORT);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected Atlas database: ${dbName}`);

  const viewerPassword = "ViewerPass123";
  const viewerEmail = testEmail("viewer");

  // ---------------------------------------------------------------- signup
  section("1-4. Signup");

  const signupRes = await api("POST", "/api/auth/signup", {
    body: { name: "Verification Viewer", email: viewerEmail, password: viewerPassword },
  });
  check("1. Signup with valid data returns 201", signupRes.status === 201, `got ${signupRes.status}: ${JSON.stringify(signupRes.data)}`);
  check("   Signup response has no password field", !hasPasswordField(signupRes.data?.user));
  check("   Signup response exposes id/name/email/role", Boolean(signupRes.data?.user?.id && signupRes.data?.user?.name && signupRes.data?.user?.email));
  check("   Signup assigns the Viewer role", signupRes.data?.user?.role === ROLES.VIEWER, `got ${signupRes.data?.user?.role}`);

  // Part 2 - email verification on signup
  const viewerTokenRaw = tokenFromUrl(signupRes.data?.emailVerification?.devVerificationUrl);
  check("   Signup account starts unverified", signupRes.data?.user?.isEmailVerified === false);
  check("   Signup response marks verification as required", signupRes.data?.emailVerification?.required === true);
  check("   Signup response exposes a verification link in dev mode", Boolean(viewerTokenRaw));
  check("   Signup response states the link lifetime", Boolean(signupRes.data?.emailVerification?.expiresIn));

  const duplicateRes = await api("POST", "/api/auth/signup", {
    body: { name: "Duplicate Viewer", email: viewerEmail.toUpperCase(), password: viewerPassword },
  });
  check("2. Duplicate email returns 409", duplicateRes.status === 409, `got ${duplicateRes.status}`);
  check("   Duplicate email is detected case-insensitively", /already/i.test(duplicateRes.data?.message || ""), duplicateRes.data?.message);

  const invalidEmailRes = await api("POST", "/api/auth/signup", {
    body: { name: "Bad Email", email: "not-an-email", password: viewerPassword },
  });
  check("3. Invalid email returns 400", invalidEmailRes.status === 400 && Boolean(invalidEmailRes.data?.errors?.email), `got ${invalidEmailRes.status}`);

  const weakPasswordRes = await api("POST", "/api/auth/signup", {
    body: { name: "Weak Password", email: testEmail("weak"), password: "123" },
  });
  check("4. Weak password returns 400", weakPasswordRes.status === 400 && Boolean(weakPasswordRes.data?.errors?.password), `got ${weakPasswordRes.status}`);

  const missingFieldsRes = await api("POST", "/api/auth/signup", { body: { email: testEmail("missing") } });
  check("   Missing name/password returns 400 with field errors", missingFieldsRes.status === 400 && Boolean(missingFieldsRes.data?.errors?.name && missingFieldsRes.data?.errors?.password));

  const roleEscalationRes = await api("POST", "/api/auth/signup", {
    body: { name: "Sneaky Admin", email: testEmail("escalation"), password: viewerPassword, role: "Admin" },
  });
  check("   Client-supplied role=Admin is ignored (Viewer created)", roleEscalationRes.data?.user?.role === ROLES.VIEWER, `got ${roleEscalationRes.data?.user?.role}`);

  // ---------------------------------------------------- Atlas document check
  section("5. MongoDB Atlas document check (bcrypt hash + timestamps)");

  const storedUser = await User.findOne({ email: viewerEmail }).select("+password");
  check("   User document exists in Atlas", Boolean(storedUser), `collection users (db: ${dbName})`);
  check("   name stored", storedUser?.name === "Verification Viewer");
  check("   email stored (lowercased)", storedUser?.email === viewerEmail);
  check("   role stored", storedUser?.role === ROLES.VIEWER);
  check("   isEmailVerified stored as false before verification", storedUser?.isEmailVerified === false);

  const storedVerification = await User.findOne({ email: viewerEmail }).select(
    "+emailVerificationTokenHash +emailVerificationExpiresAt"
  );
  check(
    "   verification token is stored as a SHA-256 hash (raw token never stored)",
    storedVerification?.emailVerificationTokenHash ===
      crypto.createHash("sha256").update(String(viewerTokenRaw)).digest("hex") &&
      storedVerification?.emailVerificationTokenHash !== viewerTokenRaw
  );
  check("   verification expiry is stored", Boolean(storedVerification?.emailVerificationExpiresAt));
  check("   createdAt/updatedAt stored", Boolean(storedUser?.createdAt && storedUser?.updatedAt));
  check("   password is a bcrypt hash", /^\$2[aby]\$\d{2}\$/.test(storedUser?.password || ""), `stored value starts with "${(storedUser?.password || "").slice(0, 7)}"`);
  check("   plain-text password is NOT stored", storedUser?.password !== viewerPassword);
  check("   bcrypt.compare(plain, stored) === true", await bcrypt.compare(viewerPassword, storedUser?.password || ""));

  // Raw driver read, bypassing every Mongoose layer
  const rawDoc = await mongoose.connection.collection("users").findOne({ email: viewerEmail });
  check("   raw driver sees the same bcrypt hash", rawDoc?.password === storedUser?.password);
  check("   raw driver doc has no plain-text password", !JSON.stringify(rawDoc).includes(viewerPassword));

  // ------------------------------------------------------- email verification
  section("5b. Email verification: link, expiry, resend, single-use");

  const preVerifyLogin = await api("POST", "/api/auth/login", {
    body: { email: viewerEmail, password: viewerPassword },
  });
  check("Login is blocked before verification (403)", preVerifyLogin.status === 403, `got ${preVerifyLogin.status}`);
  check(
    "  Blocked login returns EMAIL_NOT_VERIFIED + canResend",
    preVerifyLogin.data?.code === "EMAIL_NOT_VERIFIED" && preVerifyLogin.data?.canResend === true,
    JSON.stringify(preVerifyLogin.data)
  );
  check("  Blocked login issues no token", preVerifyLogin.data?.token === undefined);

  const missingTokenRes = await api("POST", "/api/auth/verify-email", { body: {} });
  check(
    "Missing verification token is rejected (400)",
    missingTokenRes.status === 400 && missingTokenRes.data?.code === "MISSING_VERIFICATION_TOKEN"
  );

  const badTokenRes = await api("POST", "/api/auth/verify-email", { body: { token: "deadbeefdeadbeef" } });
  check(
    "Invalid verification token is rejected (400)",
    badTokenRes.status === 400 && badTokenRes.data?.code === "INVALID_VERIFICATION_TOKEN",
    `got ${badTokenRes.status}`
  );

  const verifyRes = await api("POST", "/api/auth/verify-email", { body: { token: viewerTokenRaw } });
  check(
    "Valid verification link verifies the account (200)",
    verifyRes.status === 200 && verifyRes.data?.user?.isEmailVerified === true,
    `got ${verifyRes.status}: ${JSON.stringify(verifyRes.data)}`
  );

  const consumedTokenRes = await api("POST", "/api/auth/verify-email", { body: { token: viewerTokenRaw } });
  check(
    "Verification link is single-use",
    consumedTokenRes.status === 400 && consumedTokenRes.data?.code === "INVALID_VERIFICATION_TOKEN"
  );

  const afterVerifyDoc = await User.findOne({ email: viewerEmail }).select(
    "+emailVerificationTokenHash +emailVerificationExpiresAt"
  );
  check(
    "Token hash + expiry are cleared after verification",
    !afterVerifyDoc?.emailVerificationTokenHash && !afterVerifyDoc?.emailVerificationExpiresAt
  );

  const verifiedLogin = await api("POST", "/api/auth/login", { body: { email: viewerEmail, password: viewerPassword } });
  check("Login succeeds after verification (200)", verifiedLogin.status === 200 && Boolean(verifiedLogin.data?.token), `got ${verifiedLogin.status}`);

  const verifiedResend = await api("POST", "/api/auth/resend-verification", { body: { email: viewerEmail } });
  check(
    "Resend for an already verified account is a generic 200",
    verifiedResend.status === 200 && verifiedResend.data?.code === "RESEND_ACCEPTED"
  );
  check("  Verified account gets no new link", verifiedResend.data?.devVerificationUrl === undefined);

  // --- second, still-unverified account: cooldown + expiry + token rotation
  const slowEmail = testEmail("unverified");
  const slowPassword = "VerifierPass456";
  const slowSignup = await api("POST", "/api/auth/signup", {
    body: { name: "Slow Verifier", email: slowEmail, password: slowPassword },
  });
  const slowTokenRaw = tokenFromUrl(slowSignup.data?.emailVerification?.devVerificationUrl);
  check("Second signup also returns a verification link", Boolean(slowTokenRaw));

  const cooldownRes = await api("POST", "/api/auth/resend-verification", { body: { email: slowEmail } });
  check("Immediate resend is throttled (429)", cooldownRes.status === 429 && cooldownRes.data?.code === "RESEND_COOLDOWN", `got ${cooldownRes.status}`);
  check("  Throttle tells the client how long to wait", typeof cooldownRes.data?.retryAfterSeconds === "number");

  // Force the stored link into the past to prove expiry handling.
  await User.updateOne(
    { email: slowEmail },
    {
      $set: {
        emailVerificationExpiresAt: new Date(Date.now() - 1000),
        emailVerificationSentAt: new Date(Date.now() - 3_600_000),
      },
    }
  );

  const expiredVerifyRes = await api("POST", "/api/auth/verify-email", { body: { token: slowTokenRaw } });
  check("Expired verification link is rejected (400)", expiredVerifyRes.status === 400, `got ${expiredVerifyRes.status}`);
  check(
    "  Expired link reports VERIFICATION_TOKEN_EXPIRED",
    expiredVerifyRes.data?.code === "VERIFICATION_TOKEN_EXPIRED",
    JSON.stringify(expiredVerifyRes.data)
  );
  check("  Expired link does not verify the account", (await User.findOne({ email: slowEmail }))?.isEmailVerified === false);

  const resendRes = await api("POST", "/api/auth/resend-verification", { body: { email: slowEmail } });
  const resentTokenRaw = tokenFromUrl(resendRes.data?.devVerificationUrl);
  check("Resend issues a fresh link after the cooldown", resendRes.status === 200 && Boolean(resentTokenRaw), `got ${resendRes.status}`);
  check("  Resend rotates the token (new link differs)", Boolean(resentTokenRaw) && resentTokenRaw !== slowTokenRaw);

  const staleTokenRes = await api("POST", "/api/auth/verify-email", { body: { token: slowTokenRaw } });
  check("  Old link stops working after a resend", staleTokenRes.status === 400);

  const resentVerifyRes = await api("POST", "/api/auth/verify-email", { body: { token: resentTokenRaw } });
  check("  Fresh link verifies the account", resentVerifyRes.status === 200 && resentVerifyRes.data?.user?.isEmailVerified === true, `got ${resentVerifyRes.status}`);

  const slowLogin = await api("POST", "/api/auth/login", { body: { email: slowEmail, password: slowPassword } });
  check("  Newly verified account can log in", slowLogin.status === 200 && Boolean(slowLogin.data?.token));

  const unknownResend = await api("POST", "/api/auth/resend-verification", { body: { email: testEmail("ghost-resend") } });
  check(
    "Resend for an unknown email is a generic 200 (no enumeration)",
    unknownResend.status === 200 &&
      unknownResend.data?.code === "RESEND_ACCEPTED" &&
      unknownResend.data?.devVerificationUrl === undefined
  );

  const invalidResend = await api("POST", "/api/auth/resend-verification", { body: { email: "not-an-email" } });
  check("Resend with an invalid email is rejected (400)", invalidResend.status === 400 && invalidResend.data?.code === "INVALID_EMAIL");

  // ---------------------------------------------------------------- login
  section("6-9. Login + JWT");

  const loginRes = await api("POST", "/api/auth/login", {
    body: { email: viewerEmail, password: viewerPassword },
  });
  check("6. Login with correct password returns 200", loginRes.status === 200, `got ${loginRes.status}: ${JSON.stringify(loginRes.data)}`);
  check("   Login response has no password field", !hasPasswordField(loginRes.data?.user));
  check("   Login returns token + safe user", Boolean(loginRes.data?.token) && Boolean(loginRes.data?.user?.id));
  check("9. JWT returned after successful login", typeof loginRes.data?.token === "string" && loginRes.data.token.split(".").length === 3);

  const viewerToken = loginRes.data?.token;
  const decoded = viewerToken ? jwt.verify(viewerToken, process.env.JWT_SECRET) : {};
  check("   JWT payload contains user id + role", Boolean(decoded.id && decoded.role === ROLES.VIEWER), JSON.stringify(decoded));
  check("   JWT payload contains an expiry (exp)", typeof decoded.exp === "number");

  const wrongPasswordRes = await api("POST", "/api/auth/login", {
    body: { email: viewerEmail, password: "WrongPassword123" },
  });
  check("7. Login with wrong password returns 401", wrongPasswordRes.status === 401, `got ${wrongPasswordRes.status}`);
  check("   Wrong password message is user-friendly", wrongPasswordRes.data?.message === "Invalid email or password", wrongPasswordRes.data?.message);

  const unknownUserRes = await api("POST", "/api/auth/login", {
    body: { email: testEmail("nobody"), password: viewerPassword },
  });
  check("8. Login with nonexistent email returns 401", unknownUserRes.status === 401, `got ${unknownUserRes.status}`);
  check("   Nonexistent user returns the same message", unknownUserRes.data?.message === "Invalid email or password");

  const missingCredsRes = await api("POST", "/api/auth/login", { body: { email: viewerEmail } });
  check("   Login with missing password returns 400", missingCredsRes.status === 400);

  // -------------------------------------------------------- protected routes
  section("10-11-17-18. Protected route / token handling");

  const noTokenRes = await api("GET", "/api/auth/me");
  check("10. Protected API without token returns 401", noTokenRes.status === 401, `got ${noTokenRes.status}`);
  check("    Message does not leak internals", !/jwt|secret|stack|mongo/i.test(noTokenRes.data?.message || ""), noTokenRes.data?.message);

  const invalidTokenRes = await api("GET", "/api/auth/me", { token: "not.a.jwt" });
  check("17. Invalid token returns 401", invalidTokenRes.status === 401, `got ${invalidTokenRes.status}`);

  const tamperedToken = jwt.sign({ id: storedUser.id, role: ROLES.ADMIN }, "the-wrong-secret", { expiresIn: "1d" });
  const tamperedRes = await api("GET", "/api/auth/me", { token: tamperedToken });
  check("17. Token signed with a wrong secret returns 401", tamperedRes.status === 401, `got ${tamperedRes.status}`);

  const expiredToken = jwt.sign({ id: storedUser.id, role: ROLES.VIEWER }, process.env.JWT_SECRET, { expiresIn: "-10s" });
  const expiredRes = await api("GET", "/api/auth/me", { token: expiredToken });
  check("17. Expired token returns 401", expiredRes.status === 401, `got ${expiredRes.status}`);
  check("    Expired token message mentions the session", /expired/i.test(expiredRes.data?.message || ""), expiredRes.data?.message);

  const profileRes = await api("GET", "/api/auth/me", { token: viewerToken });
  check("18. Protected profile returns the correct user", profileRes.status === 200 && profileRes.data?.user?.email === viewerEmail, `got ${profileRes.status}`);
  check("    Profile has name/email/role/createdAt", Boolean(profileRes.data?.user?.name && profileRes.data?.user?.email && profileRes.data?.user?.role && profileRes.data?.user?.createdAt));
  check("    Profile has no password field", !hasPasswordField(profileRes.data?.user));

  const ghostEmail = testEmail("ghost");
  const ghostSignup = await api("POST", "/api/auth/signup", {
    body: { name: "Ghost User", email: ghostEmail, password: viewerPassword },
  });
  await api("POST", "/api/auth/verify-email", {
    body: { token: tokenFromUrl(ghostSignup.data?.emailVerification?.devVerificationUrl) },
  });
  const ghostLogin = await api("POST", "/api/auth/login", { body: { email: ghostEmail, password: viewerPassword } });
  const ghostMeBeforeDelete = await api("GET", "/api/auth/me", { token: ghostLogin.data?.token });
  await User.deleteOne({ email: ghostEmail });
  const ghostRes = await api("GET", "/api/auth/me", { token: ghostLogin.data?.token });
  check(
    "    Token of a deleted user returns 401",
    ghostMeBeforeDelete.status === 200 && ghostRes.status === 401,
    `before=${ghostMeBeforeDelete.status} after=${ghostRes.status}`
  );

  // ------------------------------------------------------- admin vs viewer
  section("15-16. Admin vs Viewer authorization");

  const adminEmail = testEmail("admin");
  const adminPassword = "AdminPass123";
  await User.create({
    name: "Verification Admin",
    email: adminEmail,
    password: adminPassword,
    role: ROLES.ADMIN,
    isEmailVerified: true,
  });

  const adminLoginRes = await api("POST", "/api/auth/login", { body: { email: adminEmail, password: adminPassword } });
  check("    Admin login returns 200", adminLoginRes.status === 200, `got ${adminLoginRes.status}`);
  const adminToken = adminLoginRes.data?.token;
  check("    Admin JWT carries the Admin role", jwt.decode(adminToken)?.role === ROLES.ADMIN);

  const adminOverviewRes = await api("GET", "/api/admin/overview", { token: adminToken });
  check("15. Admin reaches the Admin-only API (200)", adminOverviewRes.status === 200, `got ${adminOverviewRes.status}: ${JSON.stringify(adminOverviewRes.data)}`);
  check("    Admin overview returns user counts", typeof adminOverviewRes.data?.overview?.totalUsers === "number");

  const viewerOnAdminRes = await api("GET", "/api/admin/overview", { token: viewerToken });
  check("16. Viewer on the Admin-only API gets 403", viewerOnAdminRes.status === 403, `got ${viewerOnAdminRes.status}`);
  check("    Forbidden message is friendly", /permission/i.test(viewerOnAdminRes.data?.message || ""), viewerOnAdminRes.data?.message);

  const anonymousOnAdminRes = await api("GET", "/api/admin/overview");
  check("    Anonymous call to the Admin-only API gets 401", anonymousOnAdminRes.status === 401, `got ${anonymousOnAdminRes.status}`);

  // ----------------------------------------------------- Part 1 regression
  section("19. Part 1 regression");

  const rootRes = await api("GET", "/");
  check("    Existing GET / still works", rootRes.status === 200 && rootRes.data?.message === "RicozSpend Backend is Running", `got ${rootRes.status}: ${JSON.stringify(rootRes.data)}`);

  const unknownRouteRes = await api("GET", "/api/does-not-exist");
  check("    Unknown API route returns a JSON 404", unknownRouteRes.status === 404 && typeof unknownRouteRes.data?.message === "string");

  // ------------------------------------------------------------- cleanup
  section("Cleanup (removing verification users from Atlas)");
  const removeResult = await User.deleteMany({ email: { $in: createdEmails } });
  console.log(`  Removed ${removeResult.deletedCount} verification user(s) from ${dbName}.users`);
  const leftover = await User.countDocuments({ email: { $regex: `@${TEST_DOMAIN.replace(".", "\\.")}$` } });
  console.log(`  Verification users left behind: ${leftover}`);

  // ------------------------------------------------------------- summary
  console.log("\n================ RESULT ================");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failures.length}`);
  if (failures.length) {
    failures.forEach((label) => console.log(`   - ${label}`));
  }
  console.log("========================================");

  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  process.exit(failures.length ? 1 : 0);
};

main().catch(async (error) => {
  console.error("\nVerification crashed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});


