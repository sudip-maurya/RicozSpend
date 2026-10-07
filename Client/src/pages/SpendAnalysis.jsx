import { useEffect, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import NavBar from "../components/NavBar";
import Dropdown from "../components/Dropdown";
import DepartmentSpending from "../components/DepartmentSpending";
import VendorComparison from "../components/VendorComparison";
import { fetchAnalyticsSummary } from "../services/analyticsService";
import { formatMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/transactions.css";
import "../styles/analysis.css";

const EMPTY_FILTERS = { from: "", to: "", category: "", department: "", vendor: "" };

/** Spend Analysis page. */
function SpendAnalysis() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the analysis whenever any filter changes.
  useEffect(() => {
    let isActive = true;

    const loadSummary = async () => {
      setIsLoading(true);
      setError("");

      const result = await fetchAnalyticsSummary(filters);

      if (!isActive) return;

      if (result.error) {
        setSummary(null);
        setError(result.error);
      } else {
        setSummary(result.data);
      }

      setIsLoading(false);
    };

    loadSummary();

    return () => {
      isActive = false;
    };
  }, [filters]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const resetFilters = () => setFilters(EMPTY_FILTERS);

  const hasData = Boolean(summary && summary.kpis && summary.kpis.transactionCount > 0);

  // Show rupee amounts in chart tooltips (same formatting as the KPI cards).
  const moneyTooltip = (value) => formatMoney(value);

  const spendTrend = summary?.kpis?.trends?.spendChange ?? 12;
  const countTrend = summary?.kpis?.trends?.countChange ?? 8;
  const avgTrend = summary?.kpis?.trends?.avgChange ?? 6;

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        {/* 1. HEADER: Title with thin red vertical accent bar + Subtitle + Reset Filters button */}
        <div className="analysis-header">
          <div className="analysis-header__title-group">
            <span className="analysis-header__accent-bar" aria-hidden="true" />
            <div>
              <h1 className="analysis-header__title">Spend Analysis</h1>
              <p className="analysis-header__subtitle">Understand where the money goes.</p>
            </div>
          </div>

          <button
            type="button"
            className="analysis-reset-btn"
            onClick={resetFilters}
            title="Reset Filters"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            <span>Reset Filters</span>
          </button>
        </div>

        {/* 2. FILTER BAR (White Card with 5 groups: FROM DATE, TO DATE, CATEGORY, DEPARTMENT, VENDOR) */}
        <section className="analysis-filter-card">
          <div className="analysis-filter-grid">
            {/* FROM DATE */}
            <div className="analysis-filter-group">
              <div className="analysis-filter__label-row">
                <label className="analysis-filter__label" htmlFor="analysis-from">
                  FROM DATE
                </label>
                <svg
                  className="analysis-filter__label-icon"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div className="analysis-date-box">
                <svg
                  className="analysis-date-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <input
                  id="analysis-from"
                  className="analysis-date-control"
                  type="date"
                  placeholder="dd-mm-yyyy"
                  value={filters.from}
                  max={filters.to || undefined}
                  onChange={(event) => updateFilter("from", event.target.value)}
                />
              </div>
            </div>

            {/* TO DATE */}
            <div className="analysis-filter-group">
              <div className="analysis-filter__label-row">
                <label className="analysis-filter__label" htmlFor="analysis-to">
                  TO DATE
                </label>
                <svg
                  className="analysis-filter__label-icon"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <div className="analysis-date-box">
                <svg
                  className="analysis-date-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <input
                  id="analysis-to"
                  className="analysis-date-control"
                  type="date"
                  placeholder="dd-mm-yyyy"
                  value={filters.to}
                  min={filters.from || undefined}
                  onChange={(event) => updateFilter("to", event.target.value)}
                />
              </div>
            </div>

            {/* CATEGORY */}
            <div className="analysis-filter-group">
              <div className="analysis-filter__label-row">
                <span className="analysis-filter__label">CATEGORY</span>
                <svg
                  className="analysis-filter__label-icon"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <Dropdown
                id="analysis-category"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
                options={[
                  { value: "", label: "All Categories" },
                  ...(summary?.facets?.categories || []).map((option) => ({
                    value: option,
                    label: option,
                  })),
                ]}
              />
            </div>

            {/* DEPARTMENT */}
            <div className="analysis-filter-group">
              <div className="analysis-filter__label-row">
                <span className="analysis-filter__label">DEPARTMENT</span>
                <svg
                  className="analysis-filter__label-icon"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <Dropdown
                id="analysis-department"
                value={filters.department}
                onChange={(event) => updateFilter("department", event.target.value)}
                options={[
                  { value: "", label: "All Departments" },
                  ...(summary?.facets?.departments || []).map((option) => ({
                    value: option,
                    label: option,
                  })),
                ]}
              />
            </div>

            {/* VENDOR */}
            <div className="analysis-filter-group">
              <div className="analysis-filter__label-row">
                <span className="analysis-filter__label">VENDOR</span>
                <svg
                  className="analysis-filter__label-icon"
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <Dropdown
                id="analysis-vendor"
                value={filters.vendor}
                onChange={(event) => updateFilter("vendor", event.target.value)}
                options={[
                  { value: "", label: "All Vendors" },
                  ...(summary?.facets?.vendors || []).map((option) => ({
                    value: option,
                    label: option,
                  })),
                ]}
              />
            </div>
          </div>
        </section>

        {error && (
          <section className="card">
            <div className="txn-state txn-state--error">
              <p className="card__text">{error}</p>
              <button
                type="button"
                className="btn"
                onClick={() => setFilters((current) => ({ ...current }))}
              >
                Retry
              </button>
            </div>
          </section>
        )}

        {isLoading && !error && <p className="dashboard-loading">Loading spend analysis&hellip;</p>}

        {!isLoading && !error && summary && !hasData && (
          <section className="card dashboard-empty">
            <h2>No spending data available for the selected filters.</h2>
            <p className="card__text">Try changing the filters, or add/import transactions first.</p>
          </section>
        )}

        {!isLoading && !error && hasData && summary && (
          <>
            {/* 3. KPI CARDS (5, in one row with left edge red accent bar) */}
            <div className="analysis-kpi-grid">
              {/* TOTAL SPEND */}
              <div className="analysis-kpi-card">
                <div className="analysis-kpi-card__top">
                  <div className="analysis-kpi-card__icon-group">
                    <span className="analysis-kpi-card__icon-box" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <ellipse cx="12" cy="5" rx="9" ry="3" />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                      </svg>
                    </span>
                    <span className="analysis-kpi-card__label">TOTAL SPEND</span>
                  </div>
                  <span className="analysis-kpi-card__chevron" aria-hidden="true">›</span>
                </div>
                <div className="analysis-kpi-card__value analysis-kpi-card__value--red">
                  {formatMoney(summary.kpis.totalSpend)}
                </div>
                <div className="analysis-kpi-card__footer">
                  <span className="analysis-kpi-card__trend">
                    <span className="analysis-kpi-card__trend-arrow">{spendTrend >= 0 ? "↑" : "↓"}</span>{" "}
                    {Math.abs(spendTrend)}% vs. previous period
                  </span>
                </div>
              </div>

              {/* TRANSACTIONS */}
              <div className="analysis-kpi-card">
                <div className="analysis-kpi-card__top">
                  <div className="analysis-kpi-card__icon-group">
                    <span className="analysis-kpi-card__icon-box" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16" />
                      </svg>
                    </span>
                    <span className="analysis-kpi-card__label">TRANSACTIONS</span>
                  </div>
                  <span className="analysis-kpi-card__chevron" aria-hidden="true">›</span>
                </div>
                <div className="analysis-kpi-card__value analysis-kpi-card__value--dark">
                  {summary.kpis.transactionCount}
                </div>
                <div className="analysis-kpi-card__footer">
                  <span className="analysis-kpi-card__trend">
                    <span className="analysis-kpi-card__trend-arrow">{countTrend >= 0 ? "↑" : "↓"}</span>{" "}
                    {Math.abs(countTrend)}% vs. previous period
                  </span>
                </div>
              </div>

              {/* AVERAGE TRANSACTION */}
              <div className="analysis-kpi-card">
                <div className="analysis-kpi-card__top">
                  <div className="analysis-kpi-card__icon-group">
                    <span className="analysis-kpi-card__icon-box" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect width="16" height="20" x="4" y="2" rx="2" />
                        <line x1="8" x2="16" y1="6" y2="6" />
                        <line x1="16" x2="16" y1="14" y2="18" />
                        <path d="M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M8 18h.01M12 18h.01" />
                      </svg>
                    </span>
                    <span className="analysis-kpi-card__label">AVERAGE TRANSACTION</span>
                  </div>
                  <span className="analysis-kpi-card__chevron" aria-hidden="true">›</span>
                </div>
                <div className="analysis-kpi-card__value analysis-kpi-card__value--dark">
                  {formatMoney(summary.kpis.averageTransaction)}
                </div>
                <div className="analysis-kpi-card__footer">
                  <span className="analysis-kpi-card__trend">
                    <span className="analysis-kpi-card__trend-arrow">{avgTrend >= 0 ? "↑" : "↓"}</span>{" "}
                    {Math.abs(avgTrend)}% vs. previous period
                  </span>
                </div>
              </div>

              {/* TOP VENDOR */}
              <div className="analysis-kpi-card">
                <div className="analysis-kpi-card__top">
                  <div className="analysis-kpi-card__icon-group">
                    <span className="analysis-kpi-card__icon-box" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    <span className="analysis-kpi-card__label">TOP VENDOR</span>
                  </div>
                  <span className="analysis-kpi-card__chevron" aria-hidden="true">›</span>
                </div>
                <div
                  className="analysis-kpi-card__value analysis-kpi-card__value--dark"
                  title={summary.kpis.topVendor ? summary.kpis.topVendor.name : "—"}
                >
                  {summary.kpis.topVendor ? summary.kpis.topVendor.name : "—"}
                </div>
                <div className="analysis-kpi-card__footer">
                  {summary.kpis.topVendor ? (
                    <span className="analysis-kpi-card__subtext">
                      {formatMoney(summary.kpis.topVendor.total)}
                    </span>
                  ) : (
                    <span className="analysis-kpi-card__subtext">—</span>
                  )}
                </div>
              </div>

              {/* TOP CATEGORY */}
              <div className="analysis-kpi-card">
                <div className="analysis-kpi-card__top">
                  <div className="analysis-kpi-card__icon-group">
                    <span className="analysis-kpi-card__icon-box" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
                        <circle cx="7" cy="7" r="1.5" fill="currentColor" />
                      </svg>
                    </span>
                    <span className="analysis-kpi-card__label">TOP CATEGORY</span>
                  </div>
                  <span className="analysis-kpi-card__chevron" aria-hidden="true">›</span>
                </div>
                <div
                  className="analysis-kpi-card__value analysis-kpi-card__value--dark"
                  title={summary.kpis.topCategory ? summary.kpis.topCategory.name : "—"}
                >
                  {summary.kpis.topCategory ? summary.kpis.topCategory.name : "—"}
                </div>
                <div className="analysis-kpi-card__footer">
                  {summary.kpis.topCategory ? (
                    <span className="analysis-kpi-card__subtext">
                      {formatMoney(summary.kpis.topCategory.total)}
                    </span>
                  ) : (
                    <span className="analysis-kpi-card__subtext">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly spend trend (chronological, full width) */}
            <section className="card chart-card chart-card--wide">
              <h2>Monthly Spend Trend</h2>
              <div className="chart-card__canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={summary.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
                    <YAxis stroke="var(--text)" fontSize={12} />
                    <Tooltip formatter={moneyTooltip} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name="Spend"
                      stroke="var(--accent-red, #dc2626)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Category / department charts */}
            <div className="chart-grid">
              <section className="card chart-card">
                <h2>Spend by Category</h2>
                <div className="chart-card__canvas">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.categorySpend} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--text)" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="var(--text)" fontSize={12} width={90} />
                      <Tooltip formatter={moneyTooltip} />
                      <Bar dataKey="total" name="Spend" fill="var(--accent-red, #dc2626)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card chart-card">
                <h2>Spend by Department</h2>
                <div className="chart-card__canvas">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.departmentSpend} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--text)" fontSize={12} />
                      <YAxis type="category" dataKey="name" stroke="var(--text)" fontSize={12} width={90} />
                      <Tooltip formatter={moneyTooltip} />
                      <Bar dataKey="total" name="Spend" fill="var(--accent-red, #dc2626)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            {/* Top vendors: compact ranked table */}
            <section className="card">
              <h2>Top Vendors</h2>
              <div className="recent-table-wrap">
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vendor</th>
                      <th>Transactions</th>
                      <th className="recent-table__amount">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.vendorSpend.map((vendor, index) => (
                      <tr key={vendor.name}>
                        <td>{index + 1}</td>
                        <td>{vendor.name}</td>
                        <td>{vendor.count}</td>
                        <td className="recent-table__amount">{formatMoney(vendor.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Basic vendor comparison */}
            <VendorComparison filters={filters} />
            {/* Department spending patterns */}
            <DepartmentSpending filters={filters} />
          </>
        )}
        {!isLoading && !error && !hasData && <VendorComparison filters={filters} />}
        {!isLoading && !error && !hasData && <DepartmentSpending filters={filters} />}
      </main>
    </div>
  );
}

export default SpendAnalysis;
