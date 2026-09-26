/**
 * Client-side verification for Admin Management (Admin-only user CRUD).
 * Runs through vite's SSR build, same pattern as verifyFrontend.jsx.
 *
 * It renders /admin through the real routes and asserts on the shipped sources:
 *   - an Admin sees the "Add Admin" form + the "Admins" table
 *   - a Viewer / guest never sees the Admin-management UI
 *   - the route guard results (Admin allowed, Viewer -> Dashboard, guest -> Login)
 *   - adminService exposes the five /api/admin/admins calls
 *   - AdminOverview reuses those calls and protects the signed-in Admin
 *     (self row labelled "(you)", self deactivate/delete disabled)
 *
 * Run from Client/: npm run verify:admins
 */

import { readFileSync } from "node:fs";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../src/components/ProtectedRoute";
import { AuthContext } from "../src/context/authContext";
import { ROLES } from "../src/constants/roles";
import AdminOverview from "../src/pages/AdminOverview";
import Login from "../src/pages/Login";
import NotFound from "../src/pages/NotFound";
import { GUARD_RESULT, resolveRouteGuard } from "../src/utils/routeGuard";

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

/** Read a shipped source file (cwd = Client when run via npm script). */
const read = (relativePath) => readFileSync(`${process.cwd()}/${relativePath}`, "utf8");

/** Mirrors the routes in src/App.jsx (BrowserRouter -> MemoryRouter). */
const renderAt = (path, authValue) =>
  renderToString(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <AdminOverview />
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

const userAuth = (role) => {
  const user = {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    name: "Test Person",
    email: "test.person@ricozspend.test",
    role,
    isEmailVerified: true,
    isActive: true,
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
  console.log("RicozSpend - Admin Management client verification");

  // ------------------------------------------------------- rendered pages
  section("1. Route behaviour (/admin)");
  const adminHtml = renderAt("/admin", userAuth(ROLES.ADMIN));
  check("Admin reaches the Admin page", adminHtml.includes("Admin overview"));
  check("The page renders the Add Admin form", adminHtml.includes("Add Admin") && adminHtml.includes("admin-name"));
  check("The Add Admin form asks for name/email/password", adminHtml.includes("admin-email") && adminHtml.includes("admin-password"));
  check("The page renders the Create Admin button", adminHtml.includes("Create Admin"));
  check(
    "The page renders the Admins table (loading state first)",
    adminHtml.includes("Admins") && adminHtml.includes("Loading admins...")
  );
  check("The page still renders the Viewer management UI", adminHtml.includes("Add Viewer") && adminHtml.includes("Viewers"));
  check(
    "The workspace counts card starts in its loading state",
    adminHtml.includes("Loading admin data...")
  );

  const viewerHtml = renderAt("/admin", userAuth(ROLES.VIEWER));
  check(
    "A Viewer never sees the Admin management UI",
    !viewerHtml.includes("Add Admin") && !viewerHtml.includes("admin-name") && !viewerHtml.includes("Create Admin")
  );
  check("A Viewer render contains no Admin overview content", !viewerHtml.includes("Admin overview"));

  const guestHtml = renderAt("/admin", anonymousAuth);
  check(
    "A guest never sees the Admin management UI",
    !guestHtml.includes("Add Admin") && !guestHtml.includes("Create Admin")
  );

  section("2. Route guard results");
  check(
    "Admin is allowed on /admin",
    resolveRouteGuard({ user: userAuth(ROLES.ADMIN).user, isRestoring: false, allowedRoles: [ROLES.ADMIN] }) ===
      GUARD_RESULT.ALLOW
  );
  check(
    "Viewer is redirected to the Dashboard",
    resolveRouteGuard({ user: userAuth(ROLES.VIEWER).user, isRestoring: false, allowedRoles: [ROLES.ADMIN] }) ===
      GUARD_RESULT.REDIRECT_TO_DASHBOARD
  );
  check(
    "Anonymous visitors are sent to Login",
    resolveRouteGuard({ user: null, isRestoring: false, allowedRoles: [ROLES.ADMIN] }) ===
      GUARD_RESULT.REDIRECT_TO_LOGIN
  );

  // ------------------------------------------------------------ data layer
  section("3. Admin service (source)");
  const serviceSource = read("src/services/adminService.js");
  check("adminService exports fetchAdmins (GET /api/admin/admins)", serviceSource.includes("api.get(`${BASE}/admins`)"));
  check("adminService exports createAdmin (POST /api/admin/admins)", serviceSource.includes("api.post(`${BASE}/admins`, payload)"));
  check("adminService exports updateAdmin (PUT /api/admin/admins/:id)", serviceSource.includes("api.put(`${BASE}/admins/${id}`, payload)"));
  check(
    "adminService exports setAdminStatus (PATCH /api/admin/admins/:id/status)",
    serviceSource.includes("api.patch(`${BASE}/admins/${id}/status`, { isActive })")
  );
  check("adminService exports deleteAdmin (DELETE /api/admin/admins/:id)", serviceSource.includes("api.delete(`${BASE}/admins/${id}`)"));
  check(
    "The service keeps the Viewer endpoints untouched",
    serviceSource.includes("api.get(`${BASE}/users`)") && serviceSource.includes("api.delete(`${BASE}/users/${id}`)")
  );
  check("The service uses the shared axios client (JWT attached)", serviceSource.includes('import api from "../api/client"'));
  check("The service never hardcodes a token or base URL", !/Bearer |localhost/.test(serviceSource));

  // ------------------------------------------------------------- page code
  section("4. AdminOverview page (source)");
  const pageSource = read("src/pages/AdminOverview.jsx");
  check(
    "The page imports all Admin-management helpers",
    ["fetchAdmins", "createAdmin", "updateAdmin", "setAdminStatus", "deleteAdmin"].every((name) =>
      pageSource.includes(`  ${name},`)
    )
  );
  check("The page sends role Admin on create", pageSource.includes('createAdmin({ ...adminForm, role: "Admin" })'));
  check("The page keeps the Viewer create path (role Viewer)", pageSource.includes('createViewer({ ...form, role: "Viewer" })'));
  check("The page renders the Add Admin form with labels", pageSource.includes("<h2>Add Admin</h2>") && pageSource.includes('htmlFor="admin-password"'));
  check("The page renders the Admins table section", pageSource.includes("<h2>Admins</h2>"));
  check("The page renders a dedicated AdminRow component", pageSource.includes("function AdminRow({"));
  check("The Admin rows reuse the shared table/status styles", pageSource.includes('className="txn-table"') && pageSource.includes("import-status--invalid"));
  check("The page marks the signed-in Admin as (you)", pageSource.includes('{isSelf && " (you)"}'));
  check(
    "The page disables self delete/deactivate (isSelf guards)",
    pageSource.includes("disabled={busy || isSelf}") && pageSource.includes("disabled={busy || (isSelf && active)}")
  );
  check("The page identifies the signed-in Admin by id or email", pageSource.includes("const isSelfAdmin = (admin) =>"));
  check(
    "The page surfaces server-side guardrail messages via toasts",
    pageSource.includes('getErrorMessage(requestError, "Could not delete the admin.")')
  );
  check("The page refreshes both lists after a mutation", pageSource.includes("loadAdmins()"));
  check("The page default-exports only", pageSource.includes("export default AdminOverview;"));

  // ------------------------------------------------------------ summary
  section("Result");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failures.length}`);
  if (failures.length) {
    failures.forEach((label) => console.log(`   - ${label}`));
  }
  process.exit(failures.length ? 1 : 0);
};

main();

