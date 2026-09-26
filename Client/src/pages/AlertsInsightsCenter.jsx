import { useEffect, useMemo, useState } from "react";

import NavBar from "../components/NavBar";
import AlertRulesEditor from "../components/AlertRulesEditor";
import { useAuth } from "../context/authContext";
import { fetchAlertsCenter } from "../services/analyticsService";
import { formatDateTime, formatMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/transactions.css";

/**
 * Alerts & Insights Center page (Part 14).
 *
 * One read-only page that gathers every deterministic alert the app can derive
 * from the data it already has (see Server/src/controllers/insightsController.js).
 * The severity rules are the Admin-configured thresholds (Alerts Center -> Alert Rules editor), which the payload publishes read-only in `meta.rules` so the
 * section hints always show the live values:
 *
 *  - critical : budget usage >= the critical (or exceeded) rule
 *  - warning  : budget usage >= the warning rule, unusual transactions,
 *               month-over-month increase at or above the configured percentage
 *  - insight  : month-over-month decrease, top category/department/vendor, contributions
 *  - info     : activity snapshot, increase below the alert level + honest empty states
 *
 * Nothing here is AI-generated, stored or invented: the payload comes from
 * GET /api/insights (which reuses the Part 7/8/9 helpers), every amount is a
 * raw number formatted client-side with formatMoney, and messages are
 * currency-free facts. The only local state is the severity/period filter and
 * a session-scoped dismissal list - no write endpoint. Admin and Viewer see
 * the exact same page (ProtectedRoute with no role restriction) and it
 * contains no create/edit/delete control: the rules live in the Admin-only
 * Alert Rules editor, opened from the button in this page's header.
 */

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

/**
 * Section subtitle built from the live rules, so a saved threshold change in
 * the Alert Rules editor is reflected here without touching the page.
 */
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

/**
 * Primitive meta entries only: objects/arrays (totals, contributions) already
 * appear inside the message text, and `reason` duplicates the message too.
 */
const factEntries = (meta) =>
  Object.entries(meta || {}).filter(
    ([key, value]) =>
      key !== "reason" &&
      value !== null &&
      value !== undefined &&
      value !== "" &&
      typeof value !== "object"
  );

/**
 * Alerts & insights center page (Part 14): severity + period filters,
 * session dismiss/restore and the four grouped sections.
 */
function AlertsInsightsCenter() {
  const { isAdmin } = useAuth();
  const [showRules, setShowRules] = useState(false);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [severity, setSeverity] = useState("all");
  const [period, setPeriod] = useState("all");
  // Session-scoped dismissals: never sent to the server (there is no write
  // endpoint at all) - they simply hide cards until the session is restored.
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

  // Part 15: the live thresholds behind the alerts (falls back to the defaults
  // while loading, so the hints never render blank).
  const rules = data?.meta?.rules || DEFAULT_ALERT_RULES;

  // Summary counts always describe what is currently visible (after dismissals),
  // so the tiles can never disagree with the cards below them.
  const counts = useMemo(() => {
    const result = { total: 0, critical: 0, warning: 0, insight: 0, info: 0 };

    activeAlerts.forEach((alert) => {
      result.total += 1;
      if (result[alert.severity] !== undefined) result[alert.severity] += 1;
    });

    return result;
  }, [activeAlerts]);

  // periodKey null = "overall" fact (insights/activity) that always applies,
  // so period filtering keeps those cards visible alongside the chosen period.
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
        <div className="dashboard-head">
          <div>
            <h1 className="page-title">Alerts &amp; Insights Center</h1>
            <p className="page-subtitle">
              Rule-based alerts and insights gathered from your existing transactions and
              budgets.
            </p>
          </div>
          {isAdmin && (
            <div>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowRules((open) => !open)}
                aria-expanded={showRules}
              >
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
            <div className="alerts-summary" aria-label="Alert summary">
              <div className="alerts-summary__item">
                <span className="alerts-summary__label">Total Alerts</span>
                <span className="alerts-summary__value">{counts.total}</span>
              </div>
              <div className="alerts-summary__item">
                <span className="alerts-summary__label">Critical</span>
                <span className="alerts-summary__value aic-count--critical">
                  {counts.critical}
                </span>
              </div>
              <div className="alerts-summary__item">
                <span className="alerts-summary__label">Warnings</span>
                <span className="alerts-summary__value aic-count--warning">
                  {counts.warning}
                </span>
              </div>
              <div className="alerts-summary__item">
                <span className="alerts-summary__label">Insights</span>
                <span className="alerts-summary__value aic-count--insight">
                  {counts.insight}
                </span>
              </div>
              <div className="alerts-summary__item">
                <span className="alerts-summary__label">Info</span>
                <span className="alerts-summary__value aic-count--info">{counts.info}</span>
              </div>
              <div className="alerts-summary__item">
                <span className="alerts-summary__label">Generated</span>
                <span className="alerts-summary__value aic-summary__stamp">
                  {formatDateTime(data.generatedAt)}
                </span>
              </div>
            </div>

            <section className="card aic-toolbar" aria-label="Alert filters">
              <div className="txn-filters">
                <div className="form-field">
                  <label className="form-field__label" htmlFor="aic-severity">
                    Severity
                  </label>
                  <select
                    id="aic-severity"
                    className="txn-filter__select"
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value)}
                  >
                    <option value="all">All severities</option>
                    {SEVERITIES.map((level) => (
                      <option key={level} value={level}>
                        {SEVERITY_LABELS[level]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-field__label" htmlFor="aic-period">
                    Period
                  </label>
                  <select
                    id="aic-period"
                    className="txn-filter__select"
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                  >
                    <option value="all">All periods</option>
                    {(data.periods || []).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                {hasActiveFilters && (
                  <button type="button" className="btn btn--ghost" onClick={resetFilters}>
                    Clear filters
                  </button>
                )}

                {dismissed.length > 0 && (
                  <button type="button" className="btn btn--ghost" onClick={restoreDismissed}>
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
