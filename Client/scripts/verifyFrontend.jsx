/** Client-side verification (runs through vite's SSR build). */

import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../src/components/ProtectedRoute";
import { AuthContext } from "../src/context/authContext";
import { ROLES } from "../src/constants/roles";
import AdminOverview from "../src/pages/AdminOverview";
import Dashboard from "../src/pages/Dashboard";
import DepartmentSpendingPatterns from "../src/pages/DepartmentSpendingPatterns";
import Login from "../src/pages/Login";
import NotFound from "../src/pages/NotFound";
import Profile from "../src/pages/Profile";
import Signup from "../src/pages/Signup";
import VerifyEmail from "../src/pages/VerifyEmail";
import { clearSession, getStoredUser, getToken, saveSession } from "../src/utils/authStorage";
import { GUARD_RESULT, resolveRouteGuard } from "../src/utils/routeGuard";

let passed = 0;
const failures = [];

const check = (label, condition) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}`);
  }
};

const section = (title) => console.log(`\n=== ${title} ===`);

/** Mirrors the route tree in src/App.jsx (BrowserRouter swapped for MemoryRouter). */
const renderAt = (path, authValue) =>
  renderToString(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminOverview />
                </ProtectedRoute>
              }
            />
            {/* Department spending patterns (shared, read-only) */}
            <Route
              path="/departments"
              element={
                <ProtectedRoute>
                  <DepartmentSpendingPatterns />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </StrictMode>
  );

const anonymousAuth = {
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,
  isAdmin: false,
  isViewer: false,
  isRestoring: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
};

const userAuth = (role, isEmailVerified = true) => {
  const user = {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    name: "Test Person",
    email: "test.person@ricozspend.test",
    role,
    isEmailVerified,
    createdAt: "2026-01-02T03:04:05.000Z",
    updatedAt: "2026-01-02T03:04:05.000Z",
  };

  return {
    ...anonymousAuth,
    user,
    token: "stub.jwt.token",
    role,
    isAuthenticated: true,
    isAdmin: role === ROLES.ADMIN,
    isViewer: role === ROLES.VIEWER,
  };
};

const main = () => {
  console.log("RicozSpend Part 2 - frontend route/session verification");

  // ----------------------------------------------------------- public pages
  section("Public pages");

  const loginHtml = renderAt("/login", anonymousAuth);
  check(
    "Login page renders Email + Password fields",
    loginHtml.includes("login-email") && loginHtml.includes("login-password")
  );
  check("Login page has a Login button", loginHtml.includes(">Login</button>"));
  check("Login page links to Signup", loginHtml.includes('href="/signup"'));

  const signupHtml = renderAt("/signup", anonymousAuth);
  check(
    "Signup page renders Name/Email/Password/Confirm",
    signupHtml.includes("signup-name") &&
      signupHtml.includes("signup-email") &&
      signupHtml.includes("signup-password") &&
      signupHtml.includes("signup-confirm-password")
  );
  check("Signup page has a Create Account button", signupHtml.includes(">Create Account</button>"));
  check("Signup page links to Login", signupHtml.includes('href="/login"'));
  check("Signup page offers no Admin role selector", !signupHtml.includes('value="Admin"'));

  // ------------------------------------------- protected pages: not signed in
  // NOTE: <Navigate> redirects inside an effect, so SSR renders no protected content.
  section("11/14. Unauthenticated user is blocked and sent to Login");

  check(
    "/dashboard guard result -> redirect to Login",
    resolveRouteGuard({ user: null, isRestoring: false }) === GUARD_RESULT.REDIRECT_TO_LOGIN
  );
  check(
    "/profile guard result -> redirect to Login",
    resolveRouteGuard({ user: null, isRestoring: false }) === GUARD_RESULT.REDIRECT_TO_LOGIN
  );
  check(
    "/admin guard result -> redirect to Login",
    resolveRouteGuard({ user: null, isRestoring: false, allowedRoles: [ROLES.ADMIN] }) ===
      GUARD_RESULT.REDIRECT_TO_LOGIN
  );
  check(
    "Protected page shows a loading state (not the page) while restoring",
    resolveRouteGuard({ user: null, isRestoring: true }) === GUARD_RESULT.LOADING
  );

  const guestDashboard = renderAt("/dashboard", anonymousAuth);
  check("Guest render contains no Dashboard content", !guestDashboard.includes("page-title\">Dashboard"));
  check("Guest render contains no Profile content", !guestDashboard.includes("Account created"));
  check("Guest render does not show the restoring message", !guestDashboard.includes("Restoring your session"));

  const guestProfile = renderAt("/profile", anonymousAuth);
  check("Guest render of /profile contains no profile card", !guestProfile.includes("Account created"));

  const guestAdmin = renderAt("/admin", anonymousAuth);
  check("Guest render of /admin contains no admin content", !guestAdmin.includes("Admin overview"));

  // ------------------------------------------------------ viewer vs admin
  section("13/14/15. Viewer vs Admin authorization");

  check(
    "Viewer guard result for /admin -> redirect to Dashboard",
    resolveRouteGuard({ user: { role: ROLES.VIEWER }, isRestoring: false, allowedRoles: [ROLES.ADMIN] }) ===
      GUARD_RESULT.REDIRECT_TO_DASHBOARD
  );
  check(
    "Admin guard result for /admin -> allowed",
    resolveRouteGuard({ user: { role: ROLES.ADMIN }, isRestoring: false, allowedRoles: [ROLES.ADMIN] }) ===
      GUARD_RESULT.ALLOW
  );
  check(
    "Viewer guard result for a normal page -> allowed",
    resolveRouteGuard({ user: { role: ROLES.VIEWER }, isRestoring: false }) === GUARD_RESULT.ALLOW
  );

  const viewerDashboard = renderAt("/dashboard", userAuth(ROLES.VIEWER));
  check("Viewer reaches the Dashboard", viewerDashboard.includes('page-title">Dashboard'));
  check("Viewer's Dashboard hides the Admin link", !viewerDashboard.includes('href="/admin"'));
  check("Viewer's Dashboard shows the Viewer role", viewerDashboard.includes("Viewer"));

  const viewerAdmin = renderAt("/admin", userAuth(ROLES.VIEWER));
  check("Viewer render of /admin contains no admin content", !viewerAdmin.includes("Admin overview"));

  const adminDashboard = renderAt("/dashboard", userAuth(ROLES.ADMIN));
  check("Admin's Dashboard shows the Admin link", adminDashboard.includes('href="/admin"'));

  const adminAdmin = renderAt("/admin", userAuth(ROLES.ADMIN));
  check("Admin reaches the Admin-only page", adminAdmin.includes("Admin overview"));
  check("Admin-only page shows the signed-in email", adminAdmin.includes("test.person@ricozspend.test"));
  check("Admin-only page shows the Admin role badge", adminAdmin.includes("role-badge--admin"));

  // -------------------------------------- Department spending patterns
  section("Part 13. Department Spending Patterns page");

  check(
    "Anonymous guard -> redirect to Login (no role required to need a session)",
    resolveRouteGuard({ user: null, isRestoring: false }) === GUARD_RESULT.REDIRECT_TO_LOGIN
  );
  check(
    "Viewer guard for the shared page -> allowed",
    resolveRouteGuard({ user: { role: ROLES.VIEWER }, isRestoring: false }) === GUARD_RESULT.ALLOW
  );

  const guestDepartments = renderAt("/departments", anonymousAuth);
  check(
    "Guest render of /departments contains no page content",
    !guestDepartments.includes("Department Spending Patterns")
  );

  const viewerDepartments = renderAt("/departments", userAuth(ROLES.VIEWER));
  check(
    "Viewer reaches the Department Spending Patterns page",
    viewerDepartments.includes('page-title">Department Spending Patterns')
  );
  check(
    "  It offers the date range filter",
    viewerDepartments.includes("dept-from") && viewerDepartments.includes("dept-to")
  );
  check(
    "  It offers the category + department filters",
    viewerDepartments.includes("dept-category") && viewerDepartments.includes("dept-department")
  );
  check(
    "  The shared section shows its loading state",
    viewerDepartments.includes("Loading department spending")
  );
  check("  The navbar link is shared by every role", viewerDepartments.includes('href="/departments"'));
  check(
    "  The page is read-only (no create/edit/delete controls)",
    !viewerDepartments.includes("Add Transaction") && !viewerDepartments.includes("Delete")
  );

  const adminDepartments = renderAt("/departments", userAuth(ROLES.ADMIN));
  check(
    "Admin reaches the Department Spending Patterns page",
    adminDepartments.includes('page-title">Department Spending Patterns')
  );
  check("Admin navbar includes the Departments link", adminDepartments.includes('href="/departments"'));

  // ---------------------------------------------------------- profile page
  section("18. Profile page content");

  const profileHtml = renderAt("/profile", userAuth(ROLES.VIEWER));
  check("Profile shows the name", profileHtml.includes("Test Person"));
  check("Profile shows the email", profileHtml.includes("test.person@ricozspend.test"));
  check("Profile shows the role", profileHtml.includes("Viewer"));
  check("Profile shows a date for the account creation", /Account created<\/dt><dd>[^<]*\d/.test(profileHtml));
  check("Profile says the password is not displayed", profileHtml.includes("never displayed"));

  const unknownRouteHtml = renderAt("/does-not-exist", anonymousAuth);
  check("Unknown route still renders NotFound", unknownRouteHtml.includes("Page Not Found"));

  // ------------------------------------------------------ email verification
  section("Email verification UI");

  const verifyPageHtml = renderAt("/verify-email", anonymousAuth);
  check("Verification page renders without a token", verifyPageHtml.includes("Email verification"));
  check("  It explains that a link is needed", verifyPageHtml.includes("needs a verification link"));
  check("  It offers a resend form", verifyPageHtml.includes("verify-email-address"));
  check("  It links back to Login", verifyPageHtml.includes('href="/login"'));

  const verifyWithTokenHtml = renderAt("/verify-email?token=deadbeef", anonymousAuth);
  check(
    "Verification page starts verifying when a token is present",
    verifyWithTokenHtml.includes("Verifying your email address")
  );

  const unverifiedProfileHtml = renderAt("/profile", userAuth(ROLES.VIEWER, false));
  check("Profile shows the email as not verified", unverifiedProfileHtml.includes("Email verified") && /No - check your inbox/.test(unverifiedProfileHtml));

  const verifiedProfileHtml = renderAt("/profile", userAuth(ROLES.VIEWER, true));
  check("Profile shows the email as verified", /Email verified<\/dt><dd>Yes<\/dd>/.test(verifiedProfileHtml));

  // ------------------------------------------------------- stored session
  section("12/13. Session storage (refresh + logout)");

  const memory = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  };

  saveSession({
    token: "stored.jwt.token",
    user: { id: "abc", name: "Stored User", email: "stored@ricozspend.test", role: ROLES.VIEWER },
  });
  check(
    "Token + user are persisted for a refresh",
    getToken() === "stored.jwt.token" && getStoredUser()?.email === "stored@ricozspend.test"
  );

  clearSession();
  check("Logout clears the token and user", getToken() === null && getStoredUser() === null);

  delete globalThis.window;

  console.log("\n================ RESULT ================");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failures.length}`);
  failures.forEach((label) => console.log(`   - ${label}`));
  console.log("========================================");

  if (failures.length) {
    process.exit(1);
  }
};

main();

