import { useEffect, useState } from "react";

import { fetchVendorComparison } from "../services/analyticsService";
import { formatMoney } from "../utils/format";
import "../styles/dashboard.css";

/** Vendor Comparison section (Part 9). */
const EMPTY_FILTERS = {};

/** 72.46 / 0 -> "72.46%" - display only, sharing a single local helper. */
const formatShare = (value) => {
  const share = Number(value);

  return Number.isFinite(share) ? `${share.toFixed(2)}%` : "—";
};

function VendorComparison({ filters = EMPTY_FILTERS }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Destructured into primitives so the effect only re-runs when a filter value changes.
  const { from = "", to = "", category = "", department = "", vendor = "" } = filters || {};

  // Same in-effect async + isActive guard pattern as the Dashboard (Part 3)
  useEffect(() => {
    let isActive = true;

    const loadVendors = async () => {
      setIsLoading(true);
      setError("");

      const result = await fetchVendorComparison({ from, to, category, department, vendor });

      if (!isActive) return;

      if (result.error) {
        setData(null);
        setError(result.error);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    loadVendors();

    return () => {
      isActive = false;
    };
  }, [from, to, category, department, vendor, reloadKey]);

  const retry = () => setReloadKey((key) => key + 1);

  const vendors = data?.vendors || [];
  const noData = Boolean(data && vendors.length === 0);

  return (
    <section className="card vendor-compare-card">
      <div className="alerts-head">
        <h2>Vendor Comparison</h2>
        {data && vendors.length > 0 && (
          <span className="alerts-badge">
            {data.vendorCount} {data.vendorCount === 1 ? "Vendor" : "Vendors"}
          </span>
        )}
      </div>

      {isLoading && <p className="dashboard-loading">Loading vendor comparison&hellip;</p>}

      {!isLoading && error && (
        <div className="dashboard-alert alerts-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--ghost" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && noData && (
        <p className="card__text">No vendor spending data available.</p>
      )}

      {!isLoading && !error && data && vendors.length > 0 && (
        <>
          <div className="alerts-summary">
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Total Vendor Spend</span>
              <span className="alerts-summary__value">{formatMoney(data.totalSpend)}</span>
            </div>
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Transactions</span>
              <span className="alerts-summary__value">{data.totalTransactions}</span>
            </div>
          </div>

          <div className="recent-table-wrap">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Transactions</th>
                  <th>Share</th>
                  <th className="recent-table__amount">Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>{row.transactionCount}</td>
                    <td>
                      <div className="vendor-compare__share">
                        <span className="vendor-compare__share-value">
                          {formatShare(row.percentage)}
                        </span>
                        <span className="vendor-compare__share-bar" aria-hidden="true">
                          <span
                            className="vendor-compare__share-fill"
                            style={{ width: `${Math.min(Math.max(Number(row.percentage) || 0, 0), 100)}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="recent-table__amount">{formatMoney(row.totalSpend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default VendorComparison;
