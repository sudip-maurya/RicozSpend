import { useEffect, useState } from "react";

import { fetchSpendInsights } from "../services/analyticsService";
import { formatMoney } from "../utils/format";
import "../styles/dashboard.css";

/**
 * Automatic Spend Insights (Part 8).
 *
 * Every sentence below is produced by deterministic rules on the server from
 * the user's real transactions - no AI, no predictions, no generated text.
 * The server returns numbers/names; the wording + rupee formatting stay on the
 * client so the one existing formatter (utils/format.js) is reused.
 *
 * The component follows the dashboard's own date filter (range/from/to props),
 * so Part 8 never introduces a second filtering system.
 */

/** "1 transaction" / "5 transactions" */
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** Sentence for the month-over-month rule. */
const monthTrendMessage = (comparison) => {
  if (comparison.direction === "insufficient_data") {
    return "Not enough historical data to compare spending.";
  }

  if (comparison.direction === "no_change") {
    return "Spending is unchanged compared with the previous month.";
  }

  const direction = comparison.direction === "increase" ? "increased" : "decreased";

  return `Spending ${direction} by ${comparison.changePercentage}% compared with the previous month.`;
};

/** Sentence + detail for the top-N rules. */
const topEntityMessage = (insight) => {
  if (insight.kind === "topCategory") {
    return `${insight.name} is the highest spending category with ${formatMoney(insight.amount)}.`;
  }

  if (insight.kind === "topDepartment") {
    return `${insight.name} has the highest spending with ${formatMoney(insight.amount)}.`;
  }

  return `${insight.name} is the top vendor with ${formatMoney(insight.amount)} in spending.`;
};

/** One insight card: heading, rule sentence and optional supporting detail. */
const InsightCard = ({ insight, contributions }) => {
  const isTrend = insight.kind === "monthComparison";
  const isContribution = insight.kind === "categoryContribution";
  const isActivity = insight.kind === "transactionActivity";

  return (
    <article className={`insight-card insight-card--${insight.tone}`}>
      <span className="insight-card__label">{insight.label}</span>

      {isTrend && (
        <>
          <p className="insight-card__message">{monthTrendMessage(insight)}</p>
          {insight.direction !== "insufficient_data" && (
            <p className="insight-card__detail">
              {insight.previousMonth}: {formatMoney(insight.previousSpend || 0)}
              {"  |  "}
              {insight.currentMonth}: {formatMoney(insight.currentSpend)}
            </p>
          )}
        </>
      )}

      {!isTrend && !isContribution && !isActivity && (
        <>
          <p className="insight-card__message">{topEntityMessage(insight)}</p>
          <p className="insight-card__detail">
            {formatMoney(insight.amount)} from {plural(insight.count, "transaction")}
          </p>
        </>
      )}

      {isContribution && (
        <ul className="insight-contribution">
          {contributions.map((item) => (
            <li className="insight-contribution__row" key={item.name}>
              <span className="insight-contribution__name">{item.name}</span>
              <span className="insight-contribution__bar" aria-hidden="true">
                <span
                  className="insight-contribution__fill"
                  style={{ width: `${Math.min(item.share, 100)}%` }}
                />
              </span>
              <span className="insight-contribution__share">{item.share}%</span>
            </li>
          ))}
        </ul>
      )}

      {isActivity && (
        <p className="insight-card__message">
          {plural(insight.count, "transaction")} recorded in the selected period.
        </p>
      )}
    </article>
  );
};

/**
 * Dashboard section. The range/from/to props come from the dashboard's own
 * date filter, so Part 8 follows the single existing filtering system instead
 * of adding a second one.
 *
 *   range = "today" | "week" | "month" | "lastmonth" | "quarter" | "year" | "custom"
 *   from / to = YYYY-MM-DD, only meaningful when range is "custom"
 */
function SpendInsights({ range = "", from = "", to = "" }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Reload whenever the dashboard filter changes. Same in-effect async +
  // isActive guard pattern used by the Dashboard, Transactions and Part 7.
  useEffect(() => {
    let isActive = true;

    const loadInsights = async () => {
      setIsLoading(true);
      setError("");

      // Mirrors the dashboard's own guard: a custom range needs both dates.
      if (range === "custom" && (!from || !to)) {
        if (!isActive) return;
        setData(null);
        setError("Pick both a start and end date for the custom range.");
        setIsLoading(false);
        return;
      }

      const result = await fetchSpendInsights(range === "custom" ? { from, to } : { range });

      if (!isActive) return;

      if (result.error) {
        setData(null);
        setError(result.error);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    loadInsights();

    return () => {
      isActive = false;
    };
  }, [range, from, to, reloadKey]);

  const insights = data?.insights || [];
  const activity = data?.transactionActivity;
  const hasInsights = Boolean(activity && activity.count > 0 && insights.length > 0);

  return (
    <section className="card insights-card">
      {/* Same head/badge layout as Part 7 (reused classes, re-tinted below). */}
      <div className="alerts-head">
        <h2>Automatic Spend Insights</h2>
        {hasInsights && <span className="alerts-badge">{formatMoney(activity.totalSpend)}</span>}
      </div>

      {isLoading && <p className="dashboard-loading">Loading spend insights&hellip;</p>}

      {!isLoading && error && (
        <div className="dashboard-alert" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && !hasInsights && (
        <p className="card__text">No spending insights available.</p>
      )}

      {!isLoading && !error && hasInsights && (
        <div className="insights-grid">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              contributions={data.categoryContributions || []}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default SpendInsights;

