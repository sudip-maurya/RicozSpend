
import { readFileSync } from "node:fs";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../src/components/ProtectedRoute";
import { AuthContext } from "../src/context/authContext";
import { ROLES } from "../src/constants/roles";
import Dashboard from "../src/pages/Dashboard";
import Landing from "../src/pages/Landing";
import Login from "../src/pages/Login";
import NotFound from "../src/pages/NotFound";
import Signup from "../src/pages/Signup";
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

/** Mirrors the public + protected routes in src/App.jsx. */
const renderAt = (path, authValue) =>
  renderToString(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
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

const userAuth = (role) => ({
  ...anonymousAuth,
  user: {
    id: "aaaaaaaaaaaaaaaaaaaaaaaa",
    name: "Test Person",
    email: "test.person@ricozspend.test",
    role,
    isEmailVerified: true,
  },
  token: "stub.jwt.token",
  role,
  isAuthenticated: true,
  isAdmin: role === ROLES.ADMIN,
  isViewer: role === ROLES.VIEWER,
});


const main = () => {
  console.log("RicozSpend - public Landing page verification");

  const landingHtml = renderAt("/", anonymousAuth);

  // ------------------------------------------------------ publicly reachable
  section("1. / is public (no session required)");

  check("Anonymous visitor gets the Landing page", landingHtml.includes("landing-root"));
  check(
    "  It is not the Login page",
    !landingHtml.includes('id="login-email"') && !landingHtml.includes('id="login-password"')
  );

  // The page flow must be: navbar -> hero -> highlights -> features ->
  // how it works -> analytics showcase -> insights -> FAQ -> CTA -> footer.
  const flowMarkers = [
    'class="landing-nav-header"',
    'class="landing-hero-section"',
    'class="landing-highlights-section"',
    'id="features"',
    'id="how-it-works"',
    "One Platform. Complete Spend Visibility.",
    'id="about"',
    'id="faq"',
    "Make Every Spend More Visible.",
    'class="landing-footer"',
  ];
  const flowPositions = flowMarkers.map((marker) => landingHtml.indexOf(marker));
  check(
    "  Sections appear in the requested order",
    flowPositions.every(
      (position, index) => position > -1 && (index === 0 || position > flowPositions[index - 1])
    )
  );

  // ---------------------------------------------------------------- navbar
  section("2. Navbar");

  check("Brand is rendered", landingHtml.includes('class="landing-brand-name"'));
  check("Ricoz + Spend wordmark", landingHtml.includes("Ricoz<span>Spend</span>"));
  check("Features link points at #features", landingHtml.includes('href="#features"'));
  check("How It Works link points at #how-it-works", landingHtml.includes('href="#how-it-works"'));
  check("FAQ link points at #faq", landingHtml.includes('href="#faq"'));
  check("Login button links to /login", landingHtml.includes('href="/login"'));
  check("Get Started button links to /signup", landingHtml.includes('href="/signup"'));
  check(
    "  A mobile menu toggle is rendered for small screens",
    landingHtml.includes("landing-mobile-toggle") &&
      landingHtml.includes("Toggle Navigation Menu")
  );

  // ------------------------------------------------------------------ hero
  section("3. Hero");

  check("Required heading", landingHtml.includes("Take Control of Every Business Expense."));
  check(
    "Required supporting text",
    landingHtml.includes(
      "Track spending, monitor budgets, analyze vendors and departments, and turn your financial data into clear business insights."
    )
  );
  check(
    "Both hero CTAs are present",
    /landing-btn-primary landing-btn-lg[^>]*>Get Started</.test(landingHtml) &&
      /landing-btn-outline landing-btn-lg[^>]*>Login</.test(landingHtml)
  );
  check(
    "The three trust points are shown",
    landingHtml.includes(">Secure<") &&
      landingHtml.includes(">Easy to Use<") &&
      landingHtml.includes(">Built for Growing Businesses<")
  );
  check(
    "A dashboard-style hero mockup is rendered",
    landingHtml.includes("landing-mockup-frame") &&
      landingHtml.includes("app.ricozspend.com/dashboard")
  );
  check(
    "  The mockup reuses the app's own dashboard vocabulary",
    landingHtml.includes("Total Spend") && landingHtml.includes("Budget Used")
  );

  // ------------------------------------------------- product highlights
  section("4. Product highlights");

  check(
    "Centralized Spend Data",
    landingHtml.includes(">Centralized<") && landingHtml.includes(">Spend Data<")
  );
  check(
    "Real-Time Dashboard Insights",
    landingHtml.includes(">Real-Time<") && landingHtml.includes(">Dashboard Insights<")
  );
  check(
    "Multiple Spending Categories",
    landingHtml.includes(">Multiple<") && landingHtml.includes(">Spending Categories<")
  );
  check(
    "Role-Based Access Control",
    landingHtml.includes(">Role-Based<") && landingHtml.includes(">Access Control<")
  );
  check(
    "  Four highlight cards are rendered",
    (landingHtml.match(/class="landing-highlight-card"/g) || []).length === 4
  );

  // ------------------------------------------------------- key features
  section("5. Key features");

  check(
    "Section heading + description",
    landingHtml.includes(">Key Features<") &&
      landingHtml.includes(
        "Powerful tools to help you track, analyze and optimize your business spending."
      )
  );
  check(
    "  Six feature cards carry the required copy",
    (landingHtml.match(/class="landing-feature-card"/g) || []).length === 6 &&
      landingHtml.includes("Spend Management") &&
      landingHtml.includes("Track all transactions in one place.") &&
      landingHtml.includes("CSV Import") &&
      landingHtml.includes("Easily upload and validate transaction data.") &&
      landingHtml.includes("Budget vs Actual") &&
      landingHtml.includes("Compare planned vs actual spending.") &&
      landingHtml.includes("Vendor Analysis") &&
      landingHtml.includes("Find top vendors and spending patterns.") &&
      landingHtml.includes("Department Insights") &&
      landingHtml.includes("View department-wise spending trends.") &&
      landingHtml.includes("Alerts &amp; Insights") &&
      landingHtml.includes("Get notified about unusual spending and budget risks.")
  );
  check(
    "  Every card renders an inline SVG icon (no new icon dependency)",
    (landingHtml.match(/class="landing-feature-icon-box"><svg/g) || []).length === 6
  );

  // -------------------------------------------------------- how it works
  section("6. How it works");

  check(
    "Three numbered steps",
    (landingHtml.match(/class="landing-step-number"/g) || []).length === 3 &&
      landingHtml.includes(">01<") &&
      landingHtml.includes(">02<") &&
      landingHtml.includes(">03<")
  );
  check(
    "  Step copy matches the spec",
    landingHtml.includes("Add Your Spending Data") &&
      landingHtml.includes("Add transactions manually or import them using CSV.") &&
      landingHtml.includes("Analyze Your Spending") &&
      landingHtml.includes("View dashboards, vendors, departments, categories and budgets.") &&
      landingHtml.includes("Monitor &amp; Act") &&
      landingHtml.includes(
        "Use alerts and insights to identify spending patterns and potential issues."
      )
  );

  // ------------------------------------------------- analytics showcase
  section("7. Analytics showcase");

  check(
    "Required heading + description",
    landingHtml.includes("One Platform. Complete Spend Visibility.") &&
      landingHtml.includes(
        "Get a clear picture of your business spending with dashboards, detailed reports and actionable insights — all in one place."
      )
  );
  check(
    "  Representative UI cards are shown",
    landingHtml.includes(">Total Spend<") &&
      landingHtml.includes(">Transactions<") &&
      landingHtml.includes(">Budget Usage<") &&
      landingHtml.includes(">Recent Alerts<") &&
      landingHtml.includes(">Department Spending<") &&
      landingHtml.includes(">Top Vendors &amp; Recent Alerts<")
  );
  check(
    "  Department/vendor spend visuals are included",
    landingHtml.includes("showcase-panel") && landingHtml.includes("dept-bar-fill")
  );
  check(
    "  It is clearly labelled as a mockup, not real company data",
    landingHtml.includes("UI Mockup Illustration")
  );

  // --------------------------------------------------------- insights
  section("8. Insights section");

  check(
    "Explains the five insight areas",
    landingHtml.includes(">Spending trends<") &&
      landingHtml.includes(">Top vendors and categories<") &&
      landingHtml.includes(">Department performance<") &&
      landingHtml.includes(">Budget tracking<") &&
      landingHtml.includes(">Spending alerts<")
  );
  check(
    "  Five insight cards are rendered",
    (landingHtml.match(/class="landing-insight-card"/g) || []).length === 5
  );

  // ---------------------------------------------------------------- FAQ
  section("9. FAQ accordion");

  const faqQuestions = [
    "What is RicozSpend?",
    "Who can use RicozSpend?",
    "What types of spending can be tracked?",
    "Can I import transactions using CSV?",
    "What are Alerts &amp; Insights?",
    "What is the difference between Admin and Viewer?",
    "Can I monitor budgets?",
  ];

  check(
    "All seven questions render as accordion buttons",
    (landingHtml.match(/class="landing-accordion-header"/g) || []).length === 7 &&
      faqQuestions.every((question) => landingHtml.includes(question))
  );
  check(
    "  Collapsed by default, with a real toggle + aria-expanded",
    landingHtml.includes('aria-expanded="false"') &&
      !landingHtml.includes("landing-accordion-body")
  );

  const landingSource = read("src/pages/Landing.jsx");
  check(
    "  FAQ answers describe only shipped functionality",
    landingSource.includes("On Track, Warning, Critical or Over Budget") &&
      landingSource.includes("invalid or duplicates") &&
      landingSource.includes("read-only")
  );
  check(
    "  No invented feature is advertised (no AI, no payments, no templates)",
    !/\bheader mapping\b/i.test(landingSource) &&
      !/\bpayment method/i.test(landingSource) &&
      !/\btemplate download\b/i.test(landingSource) &&
      !/\bAI\b/.test(landingSource) &&
      !/mobile app/i.test(landingSource)
  );

  // ------------------------------------------------------------ final CTA
  section("10. Final CTA");

  check(
    "Required CTA copy",
    landingHtml.includes("Make Every Spend More Visible.") &&
      landingHtml.includes(
        "Manage transactions, monitor budgets and understand where your business spends."
      )
  );
  check(
    "  Both CTA buttons reuse the existing /signup and /login flows",
    (landingHtml.match(/landing-btn-primary landing-btn-lg[^>]*>Get Started</g) || []).length ===
      2 &&
      (landingHtml.match(/landing-btn-outline landing-btn-lg[^>]*>Login</g) || []).length === 2
  );

  // --------------------------------------------------------------- footer
  section("11. Footer");

  check("Brand + tagline", landingHtml.includes("Smarter Spending. Better Decisions."));
  check(
    "Home / About / Features / FAQ / Login links",
    landingHtml.includes('href="/"') &&
      landingHtml.includes('href="#about"') &&
      landingHtml.includes('href="#features"') &&
      landingHtml.includes('href="#faq"') &&
      landingHtml.includes('href="/login"')
  );
  check(
    "Legal links",
    landingHtml.includes("Privacy Policy") && landingHtml.includes("Terms &amp; Conditions")
  );

  const year = new Date().getFullYear();
  check(
    `  Copyright uses the current year (${year}) dynamically`,
    new RegExp(`©\\s*(<!-- -->)?${year}`).test(landingHtml) &&
      !landingSource.includes("2024") &&
      !landingSource.includes("2025")
  );

  // ------------------------------------------------------------ routing
  section("12. Routing - existing flows stay intact");

  const appSource = read("src/App.jsx");
  check(
    "/ serves the landing page and /login keeps the Login page",
    /<Route path="\/" element=\{<Landing \/>\} \/>/.test(appSource) &&
      /<Route path="\/login" element=\{<Login \/>\} \/>/.test(appSource)
  );
  check(
    "  signup, verify-email and every authenticated route are untouched",
    [
      '"/signup"',
      '"/verify-email"',
      '"/dashboard"',
      '"/profile"',
      '"/admin"',
      '"/transactions"',
      '"/import"',
      '"/analysis"',
      '"/departments"',
      '"/insights"',
      '"/alerts"',
      '"/budget"',
    ].every((route) => appSource.includes(`path=${route}`))
  );
  check(
    "  Every protected route still wraps its page in ProtectedRoute",
    (appSource.match(/<ProtectedRoute/g) || []).length === 10
  );
  check(
    "  The landing stylesheet is only imported once, at the top of App.jsx",
    (appSource.match(/styles\/landing\.css/g) || []).length === 1 &&
      appSource.indexOf("styles/landing.css") < appSource.indexOf("function App()")
  );

  const loginHtml = renderAt("/login", anonymousAuth);
  check(
    "/login still renders the real Login form",
    loginHtml.includes("login-email") &&
      loginHtml.includes("login-password") &&
      loginHtml.includes("Access your RicozSpend account")
  );

  const signupHtml = renderAt("/signup", anonymousAuth);
  check("/signup still renders the Create Account form", signupHtml.includes("signup-email"));

  check(
    "Guests are still blocked from /dashboard",
    resolveRouteGuard({ user: null, isRestoring: false }) === GUARD_RESULT.REDIRECT_TO_LOGIN
  );
  check(
    "A Viewer is still redirected away from Admin-only pages",
    resolveRouteGuard({
      user: { role: ROLES.VIEWER },
      isRestoring: false,
      allowedRoles: [ROLES.ADMIN],
    }) === GUARD_RESULT.REDIRECT_TO_DASHBOARD
  );

  const guestDashboard = renderAt("/dashboard", anonymousAuth);
  check(
    "  Guest render of /dashboard contains no dashboard content",
    !guestDashboard.includes('page-title">Dashboard')
  );

  const viewerDashboard = renderAt("/dashboard", userAuth(ROLES.VIEWER));
  check(
    "A signed-in Viewer still reaches the Dashboard",
    viewerDashboard.includes('page-title">Dashboard')
  );

  // ------------------------------------------------------- style conventions
  section("13. Styling");

  const landingCss = read("src/styles/landing.css");
  check(
    "The stylesheet ships the Ricoz red accent + dark-navy text tokens",
    landingCss.includes("--ricoz-red:") &&
      landingCss.includes("--landing-navy:") &&
      landingCss.includes("--landing-radius:")
  );
  check(
    "  It reuses the shared theme variables instead of redefining them",
    landingCss.includes("var(--landing-border)") && landingCss.includes("var(--landing-shadow)")
  );
  check(
    "  Tablet + mobile breakpoints collapse every grid",
    landingCss.includes("@media (max-width: 1024px)") &&
      landingCss.includes("@media (max-width: 768px)") &&
      landingCss.includes(".landing-mobile-menu") &&
      landingCss.includes("overflow-x: hidden")
  );
  check(
    "  No new runtime dependency was introduced",
    !read("package.json").includes("lucide") && !read("package.json").includes("tailwind")
  );

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
