import { useEffect, useState } from "react";

import { fetchUnusualSpending } from "../services/analyticsService";
import { formatDate, formatMoney } from "../utils/format";
import "../styles/dashboard.css";

/** Unusual Spending Alerts section (Part 7). */
/** Follows the dashboard's own date filter (range/from/to props) */
function UnusualSpending({ range = "", from = "", to = "" }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Same in-effect async + isActive guard pattern as the Dashboard (Part 3)
  useEffect(() => {
    let isActive = true;

    const loadAlerts = async () => {
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

      const result = await fetchUnusualSpending(range === "custom" ? { from, to } : { range });

      if (!isActive) return;

      if (result.error) {
        setData(null);
        setError(result.error);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    loadAlerts();

    return () => {
      isActive = false;
    };
  }, [reloadKey, range, from, to]);

  const retry = () => setReloadKey((key) => key + 1);

  const alerts = data?.unusualTransactions || [];
  const noTransactions = Boolean(data && data.transactionCount === 0);
  const noAlerts = Boolean(data && data.transactionCount > 0 && alerts.length === 0);

  return (
    <section className="card alerts-card">
      <div className="alerts-head">
        <h2>Unusual Spending</h2>
        {alerts.length > 0 && (
          <span className="alerts-badge">
            {alerts.length} {alerts.length === 1 ? "Alert" : "Alerts"}
          </span>
        )}
      </div>

      {isLoading && <p className="dashboard-loading">Loading unusual spending alerts&hellip;</p>}

      {!isLoading && error && (
        <div className="dashboard-alert alerts-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--ghost" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && noTransactions && (
        <p className="card__text">No transaction data available.</p>
      )}

      {!isLoading && !error && data && data.transactionCount > 0 && (
        <>
          <div className="alerts-summary">
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Average Transaction</span>
              <span className="alerts-summary__value">{formatMoney(data.averageTransaction)}</span>
            </div>
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Alert Threshold</span>
              <span className="alerts-summary__value">{formatMoney(data.threshold)}</span>
            </div>
          </div>

          {noAlerts && <p className="card__text">No unusual spending detected.</p>}

          {alerts.length > 0 && (
            <div className="alerts-grid">
              {alerts.map((alert) => (
                <article className="alert-card" key={alert.id}>
                  <div className="alert-card__top">
                    <span className="alert-card__vendor">{alert.vendor}</span>
                    <span className="alert-card__amount">{formatMoney(alert.amount)}</span>
                  </div>

                  <dl className="alert-card__meta">
                    <div>
                      <dt>Category</dt>
                      <dd>{alert.category}</dd>
                    </div>
                    <div>
                      <dt>Department</dt>
                      <dd>{alert.department}</dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>{formatDate(alert.date)}</dd>
                    </div>
                    <div>
                      <dt>Above average by</dt>
                      <dd>{formatMoney(alert.differenceFromAverage)}</dd>
                    </div>
                  </dl>

                  <p className="alert-card__reason">
                    <strong>Reason:</strong> {alert.reason}
                  </p>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default UnusualSpending;
