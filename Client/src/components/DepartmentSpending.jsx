import { useEffect, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchDepartmentSpending } from "../services/analyticsService";
import { formatMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/departments.css";

/**
 * Department Spending Patterns section (Part 10, extended for Part 13).
 *
 * Descriptive only: for every department / cost centre it shows the total
 * spend, the number of transactions, the share of total spend, the highest-
 * spending department and the average spend per department. All values come
 * from /api/analytics/department-spending, which aggregates the shared
 * workspace's real transactions - nothing is hardcoded and there is no
 * ranking or recommendation language.
 *
 * Part 13 adds the optional bar chart (`showChart`, off by default) used by
 * the dedicated Department Spending Patterns page: X-axis = department,
 * Y-axis = total spend, straight from the same rows as the table. The
 * existing Spend Analysis page keeps its Part 6/10 layout unchanged.
 *
 * Mirrors the Part 9 VendorComparison section (same layout, same classes, same
 * filter contract) so the host page only needs to pass its existing filters.
 * Read-only for every role: no create/edit/delete controls anywhere.
 */
const EMPTY_FILTERS = {};

/** 72.46 / 0 -> "72.46%" - display only, sharing a single local helper. */
const formatShare = (value) => {
  const share = Number(value);

  return Number.isFinite(share) ? `${share.toFixed(2)}%` : "—";
};

function DepartmentSpending({ filters = EMPTY_FILTERS, showChart = false }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Destructured into primitives so the effect re-runs only when a filter
  // value actually changes (and eslint's exhaustive-deps stays happy).
  const { from = "", to = "", category = "", department = "", vendor = "" } = filters || {};

  // Same in-effect async + isActive guard pattern as the Dashboard (Part 3),
  // Spend Analysis (Part 6), Unusual Spending (Part 7), Insights (Part 8) and
  // Vendor Comparison (Part 9).
  useEffect(() => {
    let isActive = true;

    const loadDepartments = async () => {
      setIsLoading(true);
      setError("");

      const result = await fetchDepartmentSpending({ from, to, category, department, vendor });

      if (!isActive) return;

      if (result.error) {
        setData(null);
        setError(result.error);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    loadDepartments();

    return () => {
      isActive = false;
    };
  }, [from, to, category, department, vendor, reloadKey]);

  const retry = () => setReloadKey((key) => key + 1);

  const departments = data?.departments || [];
  const noData = Boolean(data && departments.length === 0);

  // Part 13 summary stats. The server computes both fields from the same
  // aggregation; the local fallbacks reuse the identical math (rows arrive
  // sorted by spend descending) so the section never shows blanks.
  const highestDepartment = data?.highestSpendingDepartment || departments[0] || null;
  const averagePerDepartment =
    typeof data?.averageSpendPerDepartment === "number"
      ? data.averageSpendPerDepartment
      : data && data.departmentCount > 0
        ? Number((data.totalSpend / data.departmentCount).toFixed(2))
        : 0;

  return (
    <section className="card vendor-compare-card">
      <div className="alerts-head">
        <h2>Department Spending Patterns</h2>
        {data && departments.length > 0 && (
          <span className="alerts-badge">
            {data.departmentCount} {data.departmentCount === 1 ? "Department" : "Departments"}
          </span>
        )}
      </div>

      {isLoading && <p className="dashboard-loading">Loading department spending&hellip;</p>}

      {!isLoading && error && (
        <div className="dashboard-alert alerts-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--ghost" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && noData && (
        <p className="card__text">No department spending data available.</p>
      )}

      {!isLoading && !error && data && departments.length > 0 && (
        <>
          <div className="alerts-summary">
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Total Department Spend</span>
              <span className="alerts-summary__value">{formatMoney(data.totalSpend)}</span>
            </div>
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Transactions</span>
              <span className="alerts-summary__value">{data.totalTransactions}</span>
            </div>
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Highest-Spending Department</span>
              <span className="alerts-summary__value">
                {highestDepartment ? highestDepartment.name : "—"}
              </span>
            </div>
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Average Spend per Department</span>
              <span className="alerts-summary__value">{formatMoney(averagePerDepartment)}</span>
            </div>
          </div>

          {/* Part 13: bar chart (X = department, Y = total spend) from the
              exact same rows as the table - only the dedicated page opts in. */}
          {showChart && (
            <div className="dept-chart">
              <h3 className="dept-chart__title">Total Spend by Department</h3>
              <div className="dept-chart__canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={departments}
                    margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="name"
                      type="category"
                      stroke="var(--text)"
                      fontSize={12}
                      interval={0}
                      angle={-30}
                      textAnchor="end"
                      height={70}
                      tickMargin={4}
                    />
                    <YAxis
                      type="number"
                      dataKey="totalSpend"
                      stroke="var(--text)"
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value) => formatMoney(value)}
                      labelFormatter={(label) => `Department: ${label}`}
                    />
                    <Bar
                      dataKey="totalSpend"
                      name="Total Spend"
                      fill="var(--accent)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="recent-table-wrap">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="recent-table__amount">Total Spend</th>
                  <th>Transaction Count</th>
                  <th>% of Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td className="recent-table__amount">{formatMoney(row.totalSpend)}</td>
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

export default DepartmentSpending;
