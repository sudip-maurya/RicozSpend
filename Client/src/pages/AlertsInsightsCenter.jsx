import { useEffect, useMemo, useState } from "react";

import NavBar from "../components/NavBar";
import Dropdown from "../components/Dropdown";
import AlertRulesEditor from "../components/AlertRulesEditor";
import { useAuth } from "../context/authContext";
import { fetchAlertsCenter } from "../services/analyticsService";
import { formatDateTime, formatMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/transactions.css";
import "../styles/alerts.css";

/** Alerts & Insights Center page (Part 14). */

/** Split ISO string into clean date (e.g. "04 Oct 2026") and time ("4:00 PM"). */
const formatGeneratedSplit = (isoString) => {
  if (!isoString) return { date: "-", time: "" };
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return { date: "-", time: "" };

  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;

  return {
    date: `${day} ${month} ${year}`,
    time: `${hours}:${minutes} ${ampm}`,
  };
};

const SEVERITIES = ["critical", "warning", "insight", "info"];

const SEVERITY_LABELS = {
  critical: "Critical",
  warning: "Warning",
  insight: "Insight",
  info: "Info",
};

/** Fallback only: the effective thresholds arrive in the payload's meta.rules. */
const DEFAULT_ALERT_RULES = {
  budgetWarning: 70,
  budgetCritical: 90,
  budgetExceeded: 100,
  unusualSpending: 50,
  spendingIncrease: 20,
};

/** Section order mirrors SECTION_KEYS in the insights controller. */
const SECTIONS = [
  { key: "budget", title: "Budget Alerts" },
  { key: "unusual", title: "Unusual Spending" },
  { key: "spending", title: "Spending Insights" },
  { key: "activity", title: "Activity & Status" },
];

/** Section subtitle built from the live rules */
const sectionHint = (key, rules) => {
  switch (key) {
    case "budget":
      return `Budget usage against plan - warning at ${rules.budgetWarning}%, critical at ${rules.budgetCritical}%, exceeded at ${rules.budgetExceeded}%.`;
    case "unusual":
      return `Transactions more than ${rules.unusualSpending}% above the average transaction amount.`;
    case "spending":
      return `Alerts when spending rises ${rules.spendingIncrease}% or more month over month, plus top spenders and category contribution.`;
    default:
      return "What the current data contains - facts only, no invented numbers.";
  }
};

/** meta values whose raw number is currency (formatted client-side). */
const MONEY_META_KEYS = new Set([
  "budget",
  "actual",
  "remaining",
  "variance",
  "amount",
  "threshold",
  "averageTransaction",
  "differenceFromAverage",
  "totalSpend",
  "currentSpend",
  "previousSpend",
]);

/** meta values already computed as percentages server-side. */
const PERCENT_META_KEYS = new Set([
  "usagePercentage",
  "share",
  "changePercentage",
  "warningLevel",
]);

/** "usagePercentage" -> "Usage percentage". */
const humanizeKey = (key) => {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

const formatFact = (key, value) => {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number" && MONEY_META_KEYS.has(key)) return formatMoney(value);
  if (typeof value === "number" && PERCENT_META_KEYS.has(key)) return `${value}%`;
  return String(value);
};

/** Primitive meta entries only */
const factEntries = (meta) =>
  Object.entries(meta || {}).filter(
    ([key, value]) =>
      key !== "reason" &&
      value !== null &&
      value !== undefined &&
      value !== "" &&
      typeof value !== "object"
  );

/** Alerts & insights center page (Part 14) */
function AlertsInsightsCenter() {
  const { isAdmin } = useAuth();
  const [showRules, setShowRules] = useState(false);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [severity, setSeverity] = useState("all");
  const [period, setPeriod] = useState("all");
  // Session-scoped dismissals
  const [dismissed, setDismissed] = useState([]);

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setError("");

      const result = await fetchAlertsCenter();

      if (!isActive) return;

      if (result.error) {
        setError(result.error);
        setData(null);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    load();

    return () => {
      isActive = false;
    };
  }, [reloadKey]);

  const retry = () => setReloadKey((key) => key + 1);

  const allAlerts = useMemo(
    () =>
      data?.sections
        ? SECTIONS.flatMap((section) => data.sections[section.key] || [])
        : [],
    [data]
  );

  const activeAlerts = useMemo(
    () => allAlerts.filter((alert) => !dismissed.includes(alert.id)),
    [allAlerts, dismissed]
  );

  // Part 15: the live thresholds behind the alerts
  const rules = data?.meta?.rules || DEFAULT_ALERT_RULES;

  // Summary counts always describe what is currently visible (after dismissals)
  const counts = useMemo(() => {
    const result = { total: 0, critical: 0, warning: 0, insight: 0, info: 0 };

    activeAlerts.forEach((alert) => {
      result.total += 1;
      if (result[alert.severity] !== undefined) result[alert.severity] += 1;
    });

    return result;
  }, [activeAlerts]);

  const generatedSplit = useMemo(
    () => formatGeneratedSplit(data?.generatedAt),
    [data?.generatedAt]
  );

  // periodKey null = "overall" fact (insights/activity) that always applies
  const matchesFilters = (alert) =>
    (severity === "all" || alert.severity === severity) &&
    (period === "all" || alert.periodKey === period || alert.periodKey === null);

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: (data?.sections?.[section.key] || []).filter(
      (alert) => !dismissed.includes(alert.id) && matchesFilters(alert)
    ),
  }));

  const hasActiveFilters = severity !== "all" || period !== "all";
  const dismiss = (id) => setDismissed((current) => [...current, id]);
  const restoreDismissed = () => setDismissed([]);
  const resetFilters = () => {
    setSeverity("all");
    setPeriod("all");
  };

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="dashboard-head aic-header">
          <div className="aic-header__left">
            <h1 className="page-title">Alerts &amp; Insights Center</h1>
            <p className="page-subtitle">
              Monitor important spending alerts and rule-based insights.
            </p>
          </div>
          {isAdmin && (
            <div className="aic-header__right">
              <button
                type="button"
                className="btn btn--ghost aic-header__btn"
                onClick={() => setShowRules((open) => !open)}
                aria-expanded={showRules}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {showRules ? "Hide alert rules" : "Alert Rules"}
              </button>
            </div>
          )}
        </div>

        {/* Admin-only Alert Rules editor. */}
        {isAdmin && showRules && (
          <section className="card" aria-label="Alert rules configuration">
            <AlertRulesEditor onSaved={retry} />
          </section>
        )}

        {isLoading && <p className="dashboard-loading">Loading alerts and insights&hellip;</p>}

        {!isLoading && error && (
          <div className="dashboard-alert alerts-error" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn--ghost" onClick={retry}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && data && counts.total === 0 && (
          <div className="card dashboard-empty">
            <h2 className="section-title">No alerts right now</h2>
            <p className="card__text">
              {allAlerts.length === 0
                ? "Nothing needs attention: every check ran against your data and found no budget, spending or activity alerts."
                : "All alerts are currently dismissed. Restore them to see the full picture again."}
            </p>
            {allAlerts.length > 0 && (
              <button type="button" className="btn btn--ghost" onClick={restoreDismissed}>
                Restore dismissed alerts
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && data && counts.total > 0 && (
          <>
            <div className="alerts-summary aic-summary-grid" aria-label="Alert summary">
              <div className="aic-summary-card aic-summary-card--total">
                <span className="aic-summary-card__label">Total Alerts</span>
                <span className="aic-summary-card__value aic-summary-card__value--total">{counts.total}</span>
                <span className="aic-summary-card__caption">All active items</span>
              </div>
              <div className="aic-summary-card aic-summary-card--critical">
                <span className="aic-summary-card__label">Critical</span>
                <span className="aic-summary-card__value aic-summary-card__value--critical aic-count--critical">
                  {counts.critical}
                </span>
                <span className="aic-summary-card__caption">Needs attention</span>
              </div>
              <div className="aic-summary-card aic-summary-card--warning">
                <span className="aic-summary-card__label">Warnings</span>
                <span className="aic-summary-card__value aic-summary-card__value--warning aic-count--warning">
                  {counts.warning}
                </span>
                <span className="aic-summary-card__caption">Moderate risk</span>
              </div>
              <div className="aic-summary-card aic-summary-card--insight">
                <span className="aic-summary-card__label">Insights</span>
                <span className="aic-summary-card__value aic-summary-card__value--insight aic-count--insight">
                  {counts.insight}
                </span>
                <span className="aic-summary-card__caption">Spending patterns</span>
              </div>
              <div className="aic-summary-card aic-summary-card--info">
                <span className="aic-summary-card__label">Info</span>
                <span className="aic-summary-card__value aic-summary-card__value--info aic-count--info">
                  {counts.info}
                </span>
                <span className="aic-summary-card__caption">System notes</span>
              </div>
              <div className="aic-summary-card aic-summary-card--generated">
                <span className="aic-summary-card__label">Generated</span>
                <div className="aic-generated-block">
                  <span className="aic-generated-date">{generatedSplit.date}</span>
                  <span className="aic-generated-time">{generatedSplit.time}</span>
                </div>
                <span className="aic-summary-card__caption aic-summary__stamp" title={formatDateTime(data.generatedAt)}>
                  Live report
                </span>
              </div>
            </div>

            <section className="card aic-toolbar aic-compact-filter-bar" aria-label="Alert filters">
              <div className="aic-filter-left">
                <span className="aic-filter-label">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  Filters
                </span>

                <div className="aic-filter-item">
                  <Dropdown
                    id="aic-severity"
                    ariaLabel="Severity"
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value)}
                    options={[
                      { value: "all", label: "All severities" },
                      ...SEVERITIES.map((level) => ({
                        value: level,
                        label: SEVERITY_LABELS[level],
                      })),
                    ]}
                  />
                </div>

                <div className="aic-filter-item">
                  <Dropdown
                    id="aic-period"
                    ariaLabel="Period"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                    options={[
                      { value: "all", label: "All periods" },
                      ...(data.periods || []).map((value) => ({
                        value: value,
                        label: value,
                      })),
                    ]}
                  />
                </div>
              </div>

              <div className="aic-filter-right">
                <button
                  type="button"
                  className={`aic-reset-btn ${!hasActiveFilters ? "aic-reset-btn--disabled" : ""}`}
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  title="Clear filters"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 6 }}
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  Reset Filters
                  {/* Clear filters */}
                </button>

                {dismissed.length > 0 && (
                  <button type="button" className="aic-restore-btn" onClick={restoreDismissed}>
                    Restore {dismissed.length} dismissed
                  </button>
                )}
              </div>
            </section>

            {visibleSections.map((section) => (
              <section className="card alerts-card" key={section.key}>
                <div className="alerts-head">
                  <h2>{section.title}</h2>
                  <span className="alerts-badge">
                    {section.items.length} {section.items.length === 1 ? "Alert" : "Alerts"}
                  </span>
                </div>
                <p className="card__text">{sectionHint(section.key, rules)}</p>

                {section.items.length === 0 && (
                  <p className="aic-section-empty">
                    {hasActiveFilters
                      ? "No alerts in this section match the current filters."
                      : "No alerts in this section."}
                  </p>
                )}

                <div className="alerts-grid">
                  {section.items.map((alert) => (
                    <article
                      className={`insight-card aic-card aic-card--${alert.severity}`}
                      key={alert.id}
                    >
                      <div className="aic-card__top">
                        <span
                          className={`aic-severity aic-severity--${alert.severity}`}
                          aria-label={`Severity: ${SEVERITY_LABELS[alert.severity] || alert.severity}`}
                        >
                          {SEVERITY_LABELS[alert.severity] || alert.severity}
                        </span>
                        <span className="aic-card__spacer" aria-hidden="true" />
                        {alert.amount !== null && alert.amount !== undefined && (
                          <span className="aic-card__amount">
                            {formatMoney(alert.amount)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="aic-card__dismiss"
                          aria-label={`Dismiss alert: ${alert.title}`}
                          onClick={() => dismiss(alert.id)}
                        >
                          &times;
                        </button>
                      </div>

                      <h3 className="aic-card__title">{alert.title}</h3>
                      <p className="aic-card__message">{alert.message}</p>

                      <div className="aic-card__meta">
                        {(alert.timestamp || alert.periodKey) && (
                          <span className="aic-chip">
                            {alert.timestamp
                              ? formatDateTime(alert.timestamp)
                              : alert.periodKey}
                          </span>
                        )}
                        {alert.timestamp && alert.periodKey && (
                          <span className="aic-chip">{alert.periodKey}</span>
                        )}
                      </div>

                      {factEntries(alert.meta).length > 0 && (
                        <dl className="aic-facts">
                          {factEntries(alert.meta).map(([key, value]) => (
                            <div className="aic-facts__row" key={key}>
                              <dt>{humanizeKey(key)}</dt>
                              <dd>{formatFact(key, value)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {counts.total > 0 && visibleSections.every((section) => section.items.length === 0) && (
              <div className="card dashboard-empty">
                <p className="card__text">
                  No alerts match the current severity or period filter.
                </p>
                <button type="button" className="btn btn--ghost" onClick={resetFilters}>
                  Clear filters
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default AlertsInsightsCenter;
