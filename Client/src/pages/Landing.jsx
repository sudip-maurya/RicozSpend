import { useState } from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const currentYear = new Date().getFullYear();

  const keyFeatures = [
    {
      title: "Spend Management",
      desc: "Track all transactions in one place.",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="14" x="2" y="5" rx="2" />
          <line x1="2" x2="22" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      title: "CSV Import",
      desc: "Easily upload and validate transaction data.",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M12 12v9" />
          <path d="m8 16 4-4 4 4" />
        </svg>
      ),
    },
    {
      title: "Budget vs Actual",
      desc: "Compare planned vs actual spending.",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      ),
    },
    {
      title: "Vendor Analysis",
      desc: "Find top vendors and spending patterns.",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      title: "Department Insights",
      desc: "View department-wise spending trends.",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="16" height="20" x="4" y="2" rx="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01" />
          <path d="M16 6h.01" />
          <path d="M12 6h.01" />
          <path d="M12 10h.01" />
          <path d="M12 14h.01" />
          <path d="M16 10h.01" />
          <path d="M16 14h.01" />
          <path d="M8 10h.01" />
          <path d="M8 14h.01" />
        </svg>
      ),
    },
    {
      title: "Alerts & Insights",
      desc: "Get notified about unusual spending and budget risks.",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      ),
    },
  ];

  const highlights = [
    {
      badge: "Centralized",
      title: "Spend Data",
      desc: "Consolidate manual entries and CSV uploads into a unified ledger.",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      ),
    },
    {
      badge: "Real-Time",
      title: "Dashboard Insights",
      desc: "Live visibility over cash flow, category shares, and monthly burn rate.",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      badge: "Multiple",
      title: "Spending Categories",
      desc: "Organized tracking across operations, marketing, software, and travel.",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m7 15 5 5 5-5" />
          <path d="m7 9 5-5 5 5" />
          <rect width="18" height="18" x="3" y="3" rx="2" />
        </svg>
      ),
    },
    {
      badge: "Role-Based",
      title: "Access Control",
      desc: "Distinct permissions and capabilities for Administrators and Viewers.",
      icon: (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
  ];

  const steps = [
    {
      step: "01",
      title: "Add Your Spending Data",
      desc: "Add transactions manually or import them using CSV.",
      detail: "Clean client-side validation prevents malformed records and duplicate data before saving.",
    },
    {
      step: "02",
      title: "Analyze Your Spending",
      desc: "View dashboards, vendors, departments, categories and budgets.",
      detail: "Filter dynamically by date intervals—today, week, month, quarter, or custom ranges.",
    },
    {
      step: "03",
      title: "Monitor & Act",
      desc: "Use alerts and insights to identify spending patterns and potential issues.",
      detail: "Configurable threshold rules warn you before department limits are exceeded.",
    },
  ];


  const insightsList = [
    {
      title: "Spending trends",
      desc: "Compare current month spending against previous cycles to identify cost spikes early.",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      ),
    },
    {
      title: "Top vendors and categories",
      desc: "Determine which suppliers consume the largest portion of your organization's budget.",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <rect width="4" height="7" x="7" y="10" rx="1" />
          <rect width="4" height="12" x="13" y="5" rx="1" />
        </svg>
      ),
    },
    {
      title: "Department performance",
      desc: "Review spending distribution across Engineering, Marketing, Operations, and Sales.",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      title: "Budget tracking",
      desc: "Measure monthly actuals against set limits with warning, critical, and exceeded states.",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      ),
    },
    {
      title: "Spending alerts",
      desc: "Automated flagging for transactions higher than average and rapid spend increases.",
      icon: (
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
      ),
    },
  ];

  const faqs = [
    {
      q: "What is RicozSpend?",
      a: "RicozSpend is a modern expense tracking and spend visibility platform built for growing businesses. It lets teams track transactions, compare actuals against departmental budgets, analyze vendor allocations, and receive automated spending alerts.",
    },
    {
      q: "Who can use RicozSpend?",
      a: "RicozSpend is designed for finance managers, business founders, and team members who need spend visibility. With role-based access control, team members can be granted Viewer or Admin privileges.",
    },
    {
      q: "What types of spending can be tracked?",
      a: "You can track any business expenditure. Each transaction records an amount, a vendor, a category, a department, a date and an optional description, so the same data can be reviewed per department, per category and per vendor across the Dashboard, Analysis and Insights pages.",
    },
    {
      q: "Can I import transactions using CSV?",
      a: "Yes. Admin accounts can upload a CSV file with the columns Amount, Vendor, Category, Department and Date (plus an optional Description). Nothing is saved until you confirm: the preview shows which rows are valid, invalid or duplicates, and only the valid, non-duplicate rows are imported. Dates accept DD/MM/YYYY or YYYY-MM-DD.",
    },
    {
      q: "What are Alerts & Insights?",
      a: "It is a deterministic, rule-based view of your own data: it flags budgets above the configured warning, critical or exceeded thresholds, single transactions that are unusually high compared with your average, month-over-month spending increases, and it lists your top category, department and vendor. The thresholds are set by an Admin, and nothing is generated or guessed.",
    },
    {
      q: "What is the difference between Admin and Viewer?",
      a: "Admin accounts can add, edit and delete transactions, import CSV files, set monthly budgets, change the alert thresholds and manage user accounts. Viewer accounts are read-only: they can open the Dashboard, Analysis, Departments, Insights, Alerts and Budget pages and review everything, but they cannot change data.",
    },
    {
      q: "Can I monitor budgets?",
      a: "Yes. Budgets are set per month, per department and optionally per category, and each one is compared with actual spending. Budgets show a status of On Track, Warning, Critical or Over Budget based on the thresholds your Admin configures, and the Dashboard and Budget pages show total budget, actual spend, remaining amount and usage percentage.",
    },
  ];

  return (
    <div className="landing-root">
      {/* NAVBAR */}
      <header className="landing-nav-header">
        <div className="landing-container landing-nav-inner">
          <Link to="/" className="landing-brand">
            <span className="landing-brand-mark">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            <span className="landing-brand-name">
              Ricoz<span>Spend</span>
            </span>
          </Link>

          <nav className="landing-nav-menu">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
            <a href="#faq" className="landing-nav-link">FAQ</a>
          </nav>

          <div className="landing-nav-actions">
            <Link to="/login" className="landing-btn landing-btn-ghost">
              Login
            </Link>
            <Link to="/signup" className="landing-btn landing-btn-primary">
              Get Started
            </Link>
          </div>

          <button
            type="button"
            className="landing-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="landing-mobile-menu">
            <a href="#features" onClick={closeMobileMenu} className="landing-mobile-link">Features</a>
            <a href="#how-it-works" onClick={closeMobileMenu} className="landing-mobile-link">How It Works</a>
            <a href="#faq" onClick={closeMobileMenu} className="landing-mobile-link">FAQ</a>
            <div className="landing-mobile-menu-actions">
              <Link to="/login" onClick={closeMobileMenu} className="landing-btn landing-btn-ghost landing-btn-full">
                Login
              </Link>
              <Link to="/signup" onClick={closeMobileMenu} className="landing-btn landing-btn-primary landing-btn-full">
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* HERO */}
        <section className="landing-hero-section">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-content">
              <div className="landing-tag">
                <span className="landing-tag-dot" />
                Modern Business Spend Management
              </div>
              <h1 className="landing-hero-heading">
                Take Control of Every Business Expense.
              </h1>
              <p className="landing-hero-subtext">
                Track spending, monitor budgets, analyze vendors and departments, and turn your financial data into clear business insights.
              </p>
              <div className="landing-hero-cta">
                <Link to="/signup" className="landing-btn landing-btn-primary landing-btn-lg">
                  Get Started
                </Link>
                <Link to="/login" className="landing-btn landing-btn-outline landing-btn-lg">
                  Login
                </Link>
              </div>
              <div className="landing-trust-bar">
                <div className="landing-trust-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Secure</span>
                </div>
                <div className="landing-trust-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                  <span>Easy to Use</span>
                </div>
                <div className="landing-trust-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                    <polyline points="16 7 22 7 22 13" />
                  </svg>
                  <span>Built for Growing Businesses</span>
                </div>
              </div>
            </div>

            {/* Right Hero Visual / Interactive Mockup */}
            <div className="landing-hero-visual-wrapper">
              <div className="landing-mockup-frame">
                <div className="landing-mockup-topbar">
                  <div className="landing-mockup-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="landing-mockup-search">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>app.ricozspend.com/dashboard</span>
                  </div>
                  <div className="landing-mockup-badge">Live View</div>
                </div>

                <div className="landing-mockup-inner">
                  <div className="mock-dash-header">
                    <div>
                      <h4 className="mock-title">Financial Overview</h4>
                      <p className="mock-sub">This Month · All Departments</p>
                    </div>
                    <span className="mock-badge-status">Active Session</span>
                  </div>

                  <div className="mock-kpi-grid">
                    <div className="mock-kpi-card">
                      <span className="mock-kpi-label">Total Spend</span>
                      <span className="mock-kpi-val">₹3,42,850</span>
                      <span className="mock-kpi-tag text-green">+4.2% MoM</span>
                    </div>
                    <div className="mock-kpi-card">
                      <span className="mock-kpi-label">Transactions</span>
                      <span className="mock-kpi-val">128</span>
                      <span className="mock-kpi-tag">98.5% Valid</span>
                    </div>
                    <div className="mock-kpi-card">
                      <span className="mock-kpi-label">Budget Used</span>
                      <span className="mock-kpi-val">68.5%</span>
                      <div className="mock-prog-bar">
                        <div className="mock-prog-fill" style={{ width: "68.5%" }} />
                      </div>
                    </div>
                  </div>

                  <div className="mock-chart-row">
                    <div className="mock-chart-card">
                      <div className="mock-chart-title-wrap">
                        <span className="mock-chart-title">Spending by Category</span>
                        <span className="mock-chip">Auto-calculated</span>
                      </div>
                      <div className="mock-bars">
                        <div className="mock-bar-col">
                          <div className="mock-bar-fill h-75" />
                          <span>SaaS</span>
                        </div>
                        <div className="mock-bar-col">
                          <div className="mock-bar-fill h-55" />
                          <span>Cloud</span>
                        </div>
                        <div className="mock-bar-col">
                          <div className="mock-bar-fill h-40" />
                          <span>Mktg</span>
                        </div>
                        <div className="mock-bar-col">
                          <div className="mock-bar-fill h-60" />
                          <span>Ops</span>
                        </div>
                        <div className="mock-bar-col">
                          <div className="mock-bar-fill h-30" />
                          <span>Travel</span>
                        </div>
                      </div>
                    </div>

                    <div className="mock-alert-box">
                      <div className="mock-alert-head">
                        <span className="mock-alert-dot" />
                        <span className="mock-alert-title">Active Alert</span>
                      </div>
                      <p className="mock-alert-msg">
                        Engineering reached <strong>82%</strong> of monthly limit.
                      </p>
                      <div className="mock-alert-footer">
                        <span>Rule: Budget &gt; 70%</span>
                        <span className="mock-status-chip">Monitoring</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCT HIGHLIGHTS */}
        <section className="landing-highlights-section">
          <div className="landing-container">
            <div className="landing-highlights-grid">
              {highlights.map((item, idx) => (
                <div key={idx} className="landing-highlight-card">
                  <div className="landing-highlight-top">
                    <span className="landing-highlight-icon">{item.icon}</span>
                    <span className="landing-highlight-badge">{item.badge}</span>
                  </div>
                  <h3 className="landing-highlight-title">{item.title}</h3>
                  <p className="landing-highlight-desc">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* KEY FEATURES */}
        <section id="features" className="landing-section landing-bg-soft">
          <div className="landing-container">
            <div className="landing-section-header">
              <span className="landing-sub-badge">Platform Capabilities</span>
              <h2 className="landing-section-heading">Key Features</h2>
              <p className="landing-section-sub">
                Powerful tools to help you track, analyze and optimize your business spending.
              </p>
            </div>

            <div className="landing-features-grid">
              {keyFeatures.map((feat, idx) => (
                <div key={idx} className="landing-feature-card">
                  <div className="landing-feature-icon-box">{feat.icon}</div>
                  <h3 className="landing-feature-card-title">{feat.title}</h3>
                  <p className="landing-feature-card-desc">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="landing-section">
          <div className="landing-container">
            <div className="landing-section-header">
              <span className="landing-sub-badge">Workflow</span>
              <h2 className="landing-section-heading">How It Works</h2>
              <p className="landing-section-sub">
                A simple three-step system designed for instant spend clarity without cumbersome workflows.
              </p>
            </div>

            <div className="landing-steps-grid">
              {steps.map((st, idx) => (
                <div key={idx} className="landing-step-card">
                  <div className="landing-step-number">{st.step}</div>
                  <h3 className="landing-step-title">{st.title}</h3>
                  <p className="landing-step-desc">{st.desc}</p>
                  <p className="landing-step-detail">{st.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ANALYTICS SHOWCASE */}
        <section className="landing-section landing-bg-soft">
          <div className="landing-container">
            <div className="landing-section-header">
              <span className="landing-sub-badge">Spend Visibility</span>
              <h2 className="landing-section-heading">
                One Platform. Complete Spend Visibility.
              </h2>
              <p className="landing-section-sub">
                Get a clear picture of your business spending with dashboards, detailed reports and actionable insights — all in one place.
              </p>
            </div>

            <div className="landing-showcase-card">
              <div className="showcase-topbar">
                <div className="showcase-tabs">
                  <span className="showcase-tab active">Dashboard View</span>
                  <span className="showcase-tab">Department Breakdown</span>
                  <span className="showcase-tab">Budget Monitoring</span>
                </div>
                <div className="showcase-controls">
                  <span className="showcase-filter">Range: This Month</span>
                  <span className="showcase-scope">Workspace: Production</span>
                </div>
              </div>

              <div className="showcase-metrics-grid">
                <div className="showcase-metric-card">
                  <span className="sm-label">Total Spend</span>
                  <span className="sm-val">₹4,82,650</span>
                  <span className="sm-sub text-green">148 Transactions</span>
                </div>
                <div className="showcase-metric-card">
                  <span className="sm-label">Transactions</span>
                  <span className="sm-val">148</span>
                  <span className="sm-sub">Manual &amp; CSV imports</span>
                </div>
                <div className="showcase-metric-card">
                  <span className="sm-label">Budget Usage</span>
                  <span className="sm-val">74.2%</span>
                  <div className="sm-progress">
                    <div className="sm-progress-fill" style={{ width: "74.2%" }} />
                  </div>
                </div>
                <div className="showcase-metric-card">
                  <span className="sm-label">Recent Alerts</span>
                  <span className="sm-val">3 Active</span>
                  <span className="sm-sub text-amber">1 Warning · 2 Insights</span>
                </div>
              </div>


              <div className="showcase-main-grid">
                <div className="showcase-panel">
                  <div className="panel-header">
                    <h4>Department Spending</h4>
                    <span className="panel-tag">Budget vs Actual</span>
                  </div>
                  <div className="dept-bars-list">
                    <div className="dept-row">
                      <div className="dept-meta">
                        <span className="dept-name">Engineering</span>
                        <span className="dept-amount">₹1,85,000 / ₹2,20,000</span>
                      </div>
                      <div className="dept-bar-track">
                        <div className="dept-bar-fill" style={{ width: "84%" }} />
                      </div>
                    </div>
                    <div className="dept-row">
                      <div className="dept-meta">
                        <span className="dept-name">Marketing</span>
                        <span className="dept-amount">₹1,12,400 / ₹1,50,000</span>
                      </div>
                      <div className="dept-bar-track">
                        <div className="dept-bar-fill" style={{ width: "75%" }} />
                      </div>
                    </div>
                    <div className="dept-row">
                      <div className="dept-meta">
                        <span className="dept-name">Operations</span>
                        <span className="dept-amount">₹94,250 / ₹1,20,000</span>
                      </div>
                      <div className="dept-bar-track">
                        <div className="dept-bar-fill" style={{ width: "78%" }} />
                      </div>
                    </div>
                    <div className="dept-row">
                      <div className="dept-meta">
                        <span className="dept-name">Sales</span>
                        <span className="dept-amount">₹91,000 / ₹1,40,000</span>
                      </div>
                      <div className="dept-bar-track">
                        <div className="dept-bar-fill" style={{ width: "65%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="showcase-panel">
                  <div className="panel-header">
                    <h4>Top Vendors &amp; Recent Alerts</h4>
                    <span className="panel-tag">Rule Engine</span>
                  </div>

                  <div className="vendor-mini-list">
                    <div className="vendor-item">
                      <span className="vendor-rank">1</span>
                      <div className="vendor-info">
                        <strong>Amazon Web Services</strong>
                        <span>Cloud Infrastructure</span>
                      </div>
                      <span className="vendor-spent">₹78,400</span>
                    </div>
                    <div className="vendor-item">
                      <span className="vendor-rank">2</span>
                      <div className="vendor-info">
                        <strong>Google Workspace</strong>
                        <span>Productivity Software</span>
                      </div>
                      <span className="vendor-spent">₹34,200</span>
                    </div>
                    <div className="vendor-item">
                      <span className="vendor-rank">3</span>
                      <div className="vendor-info">
                        <strong>Slack Technologies</strong>
                        <span>Collaboration</span>
                      </div>
                      <span className="vendor-spent">₹22,500</span>
                    </div>
                  </div>

                  <div className="showcase-alert-item">
                    <div className="sai-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div className="sai-text">
                      <strong>Unusual Single Transaction</strong>
                      <p>Hardware purchase of ₹45,000 exceeds 50% above monthly transaction average.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="showcase-disclaimer">
                <span>UI Mockup Illustration</span> — Demonstrates application interface, layout, and visual components.
              </div>
            </div>
          </div>
        </section>

        {/* INSIGHTS SECTION */}
        <section id="about" className="landing-section">
          <div className="landing-container">
            <div className="landing-section-header">
              <span className="landing-sub-badge">Financial Intelligence</span>
              <h2 className="landing-section-heading">
                Turn Raw Numbers into Clear Decisions
              </h2>
              <p className="landing-section-sub">
                RicozSpend surfaces the critical facts you need to eliminate waste and optimize operational runway.
              </p>
            </div>

            <div className="landing-insights-grid">
              {insightsList.map((item, idx) => (
                <div key={idx} className="landing-insight-card">
                  <div className="landing-insight-icon">{item.icon}</div>
                  <div className="landing-insight-content">
                    <h3 className="landing-insight-title">{item.title}</h3>
                    <p className="landing-insight-desc">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section id="faq" className="landing-section landing-bg-soft">
          <div className="landing-container landing-container-narrow">
            <div className="landing-section-header">
              <span className="landing-sub-badge">Got Questions?</span>
              <h2 className="landing-section-heading">Frequently Asked Questions</h2>
              <p className="landing-section-sub">
                Answers to common questions about RicozSpend functionality, roles, and setup.
              </p>
            </div>

            <div className="landing-accordion">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} className={`landing-accordion-item ${isOpen ? "open" : ""}`}>
                    <button
                      type="button"
                      className="landing-accordion-header"
                      onClick={() => toggleFaq(idx)}
                      aria-expanded={isOpen}
                    >
                      <span className="landing-accordion-title">{faq.q}</span>
                      <span className="landing-accordion-icon">
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="landing-accordion-body">
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        {/* FINAL CTA */}
        <section className="landing-section">
          <div className="landing-container">
            <div className="landing-cta-banner">
              <div className="landing-cta-badge">Get Started Today</div>
              <h2 className="landing-cta-title">Make Every Spend More Visible.</h2>
              <p className="landing-cta-sub">
                Manage transactions, monitor budgets and understand where your business spends.
              </p>
              <div className="landing-cta-buttons">
                <Link to="/signup" className="landing-btn landing-btn-primary landing-btn-lg">
                  Get Started
                </Link>
                <Link to="/login" className="landing-btn landing-btn-outline landing-btn-lg">
                  Login
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <div className="landing-footer-col">
            <div className="landing-footer-brand">
              <span className="landing-footer-mark">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </span>
              <span className="landing-footer-name">RicozSpend</span>
            </div>
            <p className="landing-footer-tagline">Smarter Spending. Better Decisions.</p>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-heading">Navigation</span>
            <ul className="landing-footer-links">
              <li><Link to="/">Home</Link></li>
              <li><a href="#about">About</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#faq">FAQ</a></li>
              <li><Link to="/login">Login</Link></li>
            </ul>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-heading">Product</span>
            <ul className="landing-footer-links">
              <li><Link to="/signup">Get Started</Link></li>
              <li><a href="#features">Spend Management</a></li>
              <li><a href="#features">Budget vs Actual</a></li>
              <li><a href="#features">Alerts &amp; Insights</a></li>
            </ul>
          </div>

          <div className="landing-footer-col">
            <span className="landing-footer-heading">Legal</span>
            <ul className="landing-footer-links">
              <li><a href="#legal" onClick={(e) => e.preventDefault()}>Privacy Policy</a></li>
              <li><a href="#legal" onClick={(e) => e.preventDefault()}>Terms &amp; Conditions</a></li>
            </ul>
          </div>
        </div>

        <div className="landing-container landing-footer-bottom">
          <p>© {currentYear} RicozSpend. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}