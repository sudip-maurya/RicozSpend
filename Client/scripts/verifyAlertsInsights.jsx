/**
 * Client-side verification for Part 14 (Alerts & Insights Center) and Part 15
 * (Admin-configurable Alert Rules) - runs through vite's SSR build, same
 * pattern as verifyFrontend.jsx.
 *
 * It renders the pages through the real routes and checks the behaviour that
 * matters, then asserts on the shipped sources:
 *   - Admin AND Viewer can open /alerts (shared, read-only, no role gate)
 *   - anonymous users are redirected before anything renders
 *   - the loading state and the NavBar "Alerts" link
 *   - the page is default-export only, never calls a write API, formats
 *     currency client-side, covers all four severities + both filters +
 *     empty states + session-scoped dismiss/restore
 *   - the section hints are driven by the payload's live rules (meta.rules)
 *   - /settings renders the Admin-only Alert Rules editor, Viewers are
 *     redirected away from it, the NavBar link is Admin-only, the service
 *     reads/writes /api/alert-rules and the page validates + saves
 *   - dashboard.css ships the aic-* styles; index.css the severity vars
 *
 * Run from Client/: npm run verify:alerts
 */

import { readFileSync } from "node:fs";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../src/components/ProtectedRoute";
import { AuthContext } from "../src/context/authContext";
import { ROLES } from "../src/constants/roles";
import AlertsInsightsCenter from "../src/pages/AlertsInsightsCenter";
import Login from "../src/pages/Login";
import NotFound from "../src/pages/NotFound";
import Settings from "../src/pages/Settings";
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
            <Route path="/dashboard" element={<div>Dashboard stub</div>} />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <AlertsInsightsCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
                  <Settings />
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
  console.log("RicozSpend Part 14 - Alerts & Insights Center client verification");

  // ------------------------------------------------------ route behaviour
  section("1. Route behaviour (/alerts)");

  const adminHtml = renderAt("/alerts", userAuth(ROLES.ADMIN));
  check("Admin can open /alerts", adminHtml.includes("Alerts &amp; Insights Center"));
  check(
    "  The page shows its loading state first (fetch only runs client-side)",
    adminHtml.includes("Loading alerts and insights")
  );
  check("  NavBar renders the Alerts link", adminHtml.includes('href="/alerts"'));

  const viewerHtml = renderAt("/alerts", userAuth(ROLES.VIEWER));
  check(
    "Viewer can open /alerts too (shared, read-only - no role gate)",
    viewerHtml.includes("Alerts &amp; Insights Center") &&
      viewerHtml.includes('href="/alerts"')
  );

  const anonHtml = renderAt("/alerts", anonymousAuth);
  check(
    "Anonymous users never see the page",
    !anonHtml.includes("Alerts &amp; Insights Center")
  );
  check(
    "  Their guard result redirects to /login",
    resolveRouteGuard({ user: null, isRestoring: false }) === GUARD_RESULT.REDIRECT_TO_LOGIN
  );
  check(
    "  While the session restores, the guard waits (LOADING)",
    resolveRouteGuard({ user: null, isRestoring: true }) === GUARD_RESULT.LOADING
  );
  check(
    "No allowedRoles means both authenticated roles pass the guard",
    resolveRouteGuard({ user: userAuth(ROLES.VIEWER).user, isRestoring: false }) ===
      GUARD_RESULT.ALLOW &&
      resolveRouteGuard({ user: userAuth(ROLES.ADMIN).user, isRestoring: false }) ===
        GUARD_RESULT.ALLOW
  );

  // ------------------------------------------------------- route wiring
  section("2. Route and navigation wiring (source)");

  const appSource = read("src/App.jsx");
  check(
    "App.jsx imports the page",
    appSource.includes('import AlertsInsightsCenter from "./pages/AlertsInsightsCenter"')
  );
  const routeIndex = appSource.indexOf('path="/alerts"');
  const routeSlice = appSource.slice(routeIndex, routeIndex + 320);
  check(
    "/alerts route is wrapped in ProtectedRoute WITHOUT allowedRoles",
    routeIndex >= 0 &&
      routeSlice.includes("<ProtectedRoute>") &&
      routeSlice.includes("<AlertsInsightsCenter />") &&
      !routeSlice.includes("allowedRoles"),
    routeSlice.replace(/\s+/g, " ")
  );

  const navSource = read("src/components/NavBar.jsx");
  check(
    'NavBar contains the shared "Alerts" link',
    navSource.includes('{ to: "/alerts", label: "Alerts" }')
  );

  // ------------------------------------------------------------ the service
  section("3. Data service (source)");

  const serviceSource = read("src/services/analyticsService.js");
  check(
    "analyticsService exports fetchAlertsCenter",
    serviceSource.includes("export const fetchAlertsCenter")
  );
  check(
    "fetchAlertsCenter reads GET /api/insights (read-only)",
    /fetchAlertsCenter[\s\S]{0,240}?api\.get\("\/api\/insights"\)/.test(serviceSource)
  );
  check(
    "The service never posts insights data back to the server",
    !/fetchAlertsCenter[\s\S]{0,400}?api\.(post|put|patch|delete)/.test(serviceSource)
  );

  // -------------------------------------------------------------- the page
  section("4. Page behaviour (source assertions)");

  const pageSource = read("src/pages/AlertsInsightsCenter.jsx");
  check(
    "Page default-exports only (react-refresh rule)",
    pageSource.includes("export default AlertsInsightsCenter;") &&
      !/export (const|let|function|class|\{)/.test(pageSource)
  );
  check(
    "Page imports both style sheets (dashboard + transactions)",
    pageSource.includes('import "../styles/dashboard.css"') &&
      pageSource.includes('import "../styles/transactions.css"')
  );
  check(
    "Page renders the shared NavBar and the expected title",
    pageSource.includes("<NavBar />") &&
      pageSource.includes("<h1 className=\"page-title\">Alerts &amp; Insights Center</h1>")
  );
  check(
    "All four severities are defined with labels",
    pageSource.includes('const SEVERITIES = ["critical", "warning", "insight", "info"];') &&
      pageSource.includes("const SEVERITY_LABELS = {") &&
      ["critical", "warning", "insight", "info"].every((level) =>
        pageSource.includes(`${level}: `)
      )
  );
  check(
    "Cards carry dynamic severity classes for CSS",
    pageSource.includes("aic-card--${alert.severity}") &&
      pageSource.includes("aic-severity--${alert.severity}")
  );
  check(
    "Both filters exist (severity select + period select fed by payload.periods)",
    pageSource.includes('id="aic-severity"') &&
      pageSource.includes('id="aic-period"') &&
      pageSource.includes("periods") &&
      pageSource.includes("Clear filters")
  );
  check(
    "Empty states are honest (no fabricated alerts)",
    pageSource.includes("No alerts right now") &&
      pageSource.includes(
        "No alerts match the current severity or period filter."
      ) &&
      pageSource.includes("No alerts in this section.")
  );
  check(
    "Dismissals are session-scoped client state with a restore path",
    pageSource.includes("const [dismissed, setDismissed] = useState([])") &&
      pageSource.includes("restoreDismissed") &&
      pageSource.includes("Restore dismissed alerts") &&
      pageSource.includes("aria-label={`Dismiss alert: ${alert.title}`}")
  );
  check(
    "Amounts are formatted client-side (formatMoney/formatDateTime)",
    pageSource.includes("formatMoney") && pageSource.includes("formatDateTime")
  );
  check(
    "Facts render raw meta with unit-aware formatting (money keys / percent keys)",
    pageSource.includes("MONEY_META_KEYS") &&
      pageSource.includes("PERCENT_META_KEYS") &&
      pageSource.includes("humanizeKey") &&
      pageSource.includes("`${value}%`")
  );
  check(
    "The page never calls a write API (read-only surface)",
    !/api\.(post|put|patch|delete)/.test(pageSource) &&
      !pageSource.includes("fetch(") &&
      !/method:\s*"(POST|PUT|PATCH|DELETE)"/i.test(pageSource)
  );

  // ------------------------------------------------------------- the styles
  section("5. Severity styles (source assertions)");

  const dashSource = read("src/styles/dashboard.css");
  check(
    "dashboard.css styles all four card severities",
    ["critical", "warning", "insight", "info"].every((level) =>
      dashSource.includes(`.aic-card--${level}`)
    )
  );
  check(
    "dashboard.css styles all four severity badges",
    ["critical", "warning", "insight", "info"].every((level) =>
      dashSource.includes(`.aic-severity--${level}`)
    )
  );
  check(
    "Toolbar / summary stamp / dismiss button / facts list are styled",
    dashSource.includes(".aic-toolbar") &&
      dashSource.includes(".aic-summary__stamp") &&
      dashSource.includes(".aic-card__dismiss") &&
      dashSource.includes(".aic-facts")
  );
  check(
    "Responsive rules include the 640px breakpoint",
    dashSource.includes("@media (max-width: 640px)")
  );

  const indexSource = read("src/index.css");
  const warningDefs = (indexSource.match(/--warning:/g) || []).length;
  const infoDefs = (indexSource.match(/--info:/g) || []).length;
  check(
    "--warning and --info exist in both light and dark themes (2 each)",
    warningDefs >= 2 && infoDefs >= 2,
    JSON.stringify({ warningDefs, infoDefs })
  );

  // ------------------------------------- Part 15: admin Alert Rules settings
  section("6. Settings -> Alert Rules (Part 15, Admin-only)");

  const adminSettings = renderAt("/settings", userAuth(ROLES.ADMIN));
  check(
    "Admin can open /settings and sees the Alert Rules editor",
    adminSettings.includes("Settings") &&
      adminSettings.includes("Alert Rules") &&
      adminSettings.includes("Loading alert rules")
  );
  check(
    "  The Admin navbar links to /settings",
    adminSettings.includes('href="/settings"')
  );

  const viewerSettings = renderAt("/settings", userAuth(ROLES.VIEWER));
  check(
    "Viewer never sees the Alert Rules UI",
    !viewerSettings.includes("Alert Rules") && !viewerSettings.includes("Save alert rules")
  );
  check(
    "  Viewer navbar has no Settings link",
    !viewerSettings.includes('href="/settings"')
  );
  check(
    "Guard results: Admin allowed, Viewer redirected, anonymous to login",
    resolveRouteGuard({
      user: userAuth(ROLES.ADMIN).user,
      isRestoring: false,
      allowedRoles: [ROLES.ADMIN],
    }) === GUARD_RESULT.ALLOW &&
      resolveRouteGuard({
        user: userAuth(ROLES.VIEWER).user,
        isRestoring: false,
        allowedRoles: [ROLES.ADMIN],
      }) === GUARD_RESULT.REDIRECT_TO_DASHBOARD &&
      resolveRouteGuard({
        user: null,
        isRestoring: false,
        allowedRoles: [ROLES.ADMIN],
      }) === GUARD_RESULT.REDIRECT_TO_LOGIN
  );

  const settingsRouteIndex = appSource.indexOf('path="/settings"');
  const settingsRouteSlice = appSource.slice(settingsRouteIndex, settingsRouteIndex + 320);
  check(
    "App.jsx imports Settings and protects /settings with allowedRoles=[Admin]",
    appSource.includes('import Settings from "./pages/Settings"') &&
      settingsRouteIndex >= 0 &&
      settingsRouteSlice.includes("allowedRoles={[ROLES.ADMIN]}") &&
      settingsRouteSlice.includes("<Settings />"),
    settingsRouteSlice.replace(/\s+/g, " ")
  );
  const navLinksStart = navSource.indexOf("const NAV_LINKS = [");
  const navLinksBlock = navSource.slice(navLinksStart, navSource.indexOf("];", navLinksStart));
  const adminLinksStart = navSource.indexOf("const ADMIN_LINKS = [");
  const adminLinksBlock = navSource.slice(adminLinksStart, navSource.indexOf("];", adminLinksStart));
  check(
    "NavBar keeps Settings in the Admin-only list (never shared with Viewers)",
    navLinksStart >= 0 &&
      adminLinksStart >= 0 &&
      adminLinksBlock.includes('to: "/settings"') &&
      !navLinksBlock.includes("/settings"),
    JSON.stringify({ shared: navLinksBlock.includes("/settings"), admin: adminLinksBlock })
  );

  const rulesService = read("src/services/alertRulesService.js");
  check(
    "alertRulesService reads GET and writes PUT /api/alert-rules",
    rulesService.includes("export const fetchAlertRules") &&
      rulesService.includes("export const updateAlertRules") &&
      rulesService.includes('const BASE = "/api/alert-rules"') &&
      rulesService.includes("api.get(BASE)") &&
      rulesService.includes("api.put(BASE, rules)")
  );
  check(
    "  The rules service uses the shared axios client only (JWT attached)",
    rulesService.includes('import api from "../api/client"') &&
      !rulesService.includes("fetch(") &&
      !rulesService.includes("DELETE")
  );

  const settingsSource = read("src/pages/Settings.jsx");
  check(
    "Settings page default-exports only and renders the shared NavBar",
    settingsSource.includes("export default Settings;") &&
      !/export (const|let|function|class|\{)/.test(settingsSource) &&
      settingsSource.includes("<NavBar />")
  );
  check(
    "  Inputs are generated from the API field metadata (one per rule)",
    settingsSource.includes("const fields = data?.fields || [];") &&
      settingsSource.includes("fields.map((field)") &&
      settingsSource.includes("alert-rule-${field.key}") &&
      settingsSource.includes('type="number"') &&
      settingsSource.includes("field.min") &&
      settingsSource.includes("field.max")
  );
  check(
    "  Validation mirrors the server (numeric, range, ordering) before saving",
    settingsSource.includes("validateRulesForm") &&
      settingsSource.includes("must be a number.") &&
      settingsSource.includes("must be between") &&
      settingsSource.includes("Budget Critical must be greater than Budget Warning.") &&
      settingsSource.includes("Budget Exceeded must be greater than or equal to Budget Critical.")
  );
  check(
    "  Saving goes through the Admin-only service and reports the outcome",
    settingsSource.includes("updateAlertRules(validation.values)") &&
      settingsSource.includes("Restore defaults") &&
      settingsSource.includes("alert--success") &&
      settingsSource.includes("alert--error")
  );

  // ------------------------------ Part 15: alerts use the saved thresholds
  section("7. Alerts center uses the live thresholds (Part 15)");

  check(
    "Section hints come from the payload's effective rules (meta.rules)",
    pageSource.includes("const rules = data?.meta?.rules || DEFAULT_ALERT_RULES") &&
      pageSource.includes("sectionHint(section.key, rules)") &&
      pageSource.includes("const DEFAULT_ALERT_RULES = {")
  );
  check(
    "  Budget / unusual / increase hints interpolate the configured values",
    pageSource.includes("${rules.budgetWarning}%") &&
      pageSource.includes("${rules.budgetCritical}%") &&
      pageSource.includes("${rules.budgetExceeded}%") &&
      pageSource.includes("${rules.unusualSpending}%") &&
      pageSource.includes("${rules.spendingIncrease}%")
  );
  check(
    "  No hardcoded threshold copy is left on the alerts page",
    !pageSource.includes("critical at 100%") &&
      !pageSource.includes("warning at 80%") &&
      !pageSource.includes("2.5x the average")
  );
  check(
    "  The alerts page stays read-only (rules are edited on Settings)",
    !/api\.(post|put|patch|delete)/.test(pageSource) &&
      !pageSource.includes("alertRulesService")
  );

  // ------------------------------------------------------------- summary
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
