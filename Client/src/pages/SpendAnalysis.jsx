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
import DepartmentSpending from "../components/DepartmentSpending";
import VendorComparison from "../components/VendorComparison";
import { fetchAnalyticsSummary } from "../services/analyticsService";
import { formatMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/transactions.css";
import "../styles/analysis.css";

const EMPTY_FILTERS = { from: "", to: "", category: "", department: "", vendor: "" };

/** Spend Analysis page (Part 6). */
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

  const hasActiveFilters = Object.values(filters).some(Boolean);
  const hasData = Boolean(summary && summary.kpis && summary.kpis.transactionCount > 0);

  // Show rupee amounts in chart tooltips (same formatting as the KPI cards).
  const moneyTooltip = (value) => formatMoney(value);

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="dashboard-head">
          <div>
            <h1 className="page-title">Spend Analysis</h1>
            <p className="page-subtitle">Understand where the money goes.</p>
          </div>
        </div>

        {/* Filters: date range + category + department + vendor, all together */}
        <section className="card">
          <div className="txn-filters">
            <div className="form-field">
              <label className="form-field__label" htmlFor="analysis-from">
                From Date
              </label>
              <input
                id="analysis-from"
                className="txn-filter__date"
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => updateFilter("from", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="analysis-to">
                To Date
              </label>
              <input
                id="analysis-to"
                className="txn-filter__date"
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => updateFilter("to", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="analysis-category">
                Category
              </label>
              <select
                id="analysis-category"
                className="txn-filter__select"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
              >
                <option value="">All</option>
                {(summary?.facets?.categories || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="analysis-department">
                Department
              </label>
              <select
                id="analysis-department"
                className="txn-filter__select"
                value={filters.department}
                onChange={(event) => updateFilter("department", event.target.value)}
              >
                <option value="">All</option>
                {(summary?.facets?.departments || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="analysis-vendor">
                Vendor
              </label>
              <select
                id="analysis-vendor"
                className="txn-filter__select"
                value={filters.vendor}
                onChange={(event) => updateFilter("vendor", event.target.value)}
              >
                <option value="">All</option>
                {(summary?.facets?.vendors || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button type="button" className="btn btn--ghost" onClick={resetFilters}>
                Reset filters
              </button>
            )}
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
            {/* KPI cards */}
            <div className="kpi-grid analysis-kpi-grid">
              <section className="card kpi-card">
                <h2>Total Spend</h2>
                <p className="kpi-card__value">{formatMoney(summary.kpis.totalSpend)}</p>
              </section>
              <section className="card kpi-card">
                <h2>Transaction Count</h2>
                <p className="kpi-card__value">{summary.kpis.transactionCount}</p>
              </section>
              <section className="card kpi-card">
                <h2>Average Transaction</h2>
                <p className="kpi-card__value">{formatMoney(summary.kpis.averageTransaction)}</p>
              </section>
              <section className="card kpi-card">
                <h2>Top Vendor</h2>
                <p className="kpi-card__value kpi-card__value--text">
                  {summary.kpis.topVendor ? summary.kpis.topVendor.name : "—"}
                </p>
                {summary.kpis.topVendor && (
                  <p className="kpi-card__hint">{formatMoney(summary.kpis.topVendor.total)}</p>
                )}
              </section>
              <section className="card kpi-card">
                <h2>Top Category</h2>
                <p className="kpi-card__value kpi-card__value--text">
                  {summary.kpis.topCategory ? summary.kpis.topCategory.name : "—"}
                </p>
                {summary.kpis.topCategory && (
                  <p className="kpi-card__hint">{formatMoney(summary.kpis.topCategory.total)}</p>
                )}
              </section>
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
                      stroke="var(--accent)"
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
                      <Bar dataKey="total" name="Spend" fill="var(--accent)" radius={[0, 4, 4, 0]} />
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
                      <Bar dataKey="total" name="Spend" fill="var(--accent)" radius={[0, 4, 4, 0]} />
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
            {/* Part 9: basic vendor comparison (factual spend / txns / share). Reuses this page's existing filters; no new page or navigation. */}
            <VendorComparison filters={filters} />
            {/* Part 10: department spending patterns (factual spend / txns / share). Reuses this page's existing filters; no new page or navigation. */}
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
