import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { fetchDashboardSummary } from "../services/dashboardService";
import NavBar from "../components/NavBar";
import Dropdown from "../components/Dropdown";
import UnusualSpending from "../components/UnusualSpending";
import SpendInsights from "../components/SpendInsights";
import { useAuth } from "../context/authContext";
import { fetchBudgetComparison } from "../services/budgetService";
import { formatDate, formatMoney } from "../utils/format";
import "../styles/dashboard.css";
const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "lastmonth", label: "Last Month" },
  { value: "last3months", label: "Last 3 Months" },
  { value: "last6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

/** Dashboard - real spend overview backed by /api/dashboard/summary. */
function Dashboard() {
  const { user } = useAuth();

  const [range, setRange] = useState("last3months");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Budget vs Actual totals, loaded once (budgets are monthly).
  const [budgetSummary, setBudgetSummary] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadBudgetSummary = async () => {
      const result = await fetchBudgetComparison();

      // A missing/failed budget comparison simply hides the section - the rest of the dashboard keeps working.
      if (!isActive) return;
      setBudgetSummary(result.error ? null : result.data);
    };

    loadBudgetSummary();

    return () => {
      isActive = false;
    };
  }, []);

  // Re-fetch trigger for refresh action
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch the summary whenever the date filter or reloadKey changes.
  useEffect(() => {
    let isActive = true;

    const loadSummary = async () => {
      setIsLoading(true);
      setError("");

      // P2-2: the summary fetch lives in the dashboard service module now.
      const params = { range };
      if (range === "custom") {
        if (!customFrom || !customTo) {
          if (!isActive) return;
          setSummary(null);
          setError("Pick both a start and end date for the custom range.");
          setIsLoading(false);
          return;
        }
        params.from = customFrom;
        params.to = customTo;
      }

      const result = await fetchDashboardSummary(params);

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
  }, [range, customFrom, customTo, reloadKey]);

  const handleRangeChange = (event) => {
    setRange(event.target.value);
    setIsLoading(true);
  };

  const handleCustomFromChange = (event) => {
    setCustomFrom(event.target.value);
    setIsLoading(true);
  };

  const handleCustomToChange = (event) => {
    setCustomTo(event.target.value);
    setIsLoading(true);
  };

  const handleRefresh = () => {
    setReloadKey((prev) => prev + 1);
  };

  const hasData = Boolean(summary && summary.transactionCount > 0);
  const showEmptyState = Boolean(summary) && !hasData && !error;

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="dashboard-head">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">
              Welcome back, {user?.name}. Here is the workspace spending overview.
            </p>
          </div>

          <div className="dashboard-head__actions">
            <div className="date-filter" role="group" aria-label="Dashboard date filter">
              <Dropdown
                id="dashboard-date-range"
                value={range}
                onChange={handleRangeChange}
                options={DATE_RANGES}
                ariaLabel="Date range"
                align="right"
                style={{ minWidth: 155 }}
              />
              {range === "custom" && (
                <div className="date-filter__custom">
                  <input
                    type="date"
                    className="date-filter__date"
                    value={customFrom}
                    max={customTo || undefined}
                    onChange={handleCustomFromChange}
                    aria-label="From date"
                  />
                  <span className="date-filter__dash">&ndash;</span>
                  <input
                    type="date"
                    className="date-filter__date"
                    value={customTo}
                    min={customFrom || undefined}
                    onChange={handleCustomToChange}
                    aria-label="To date"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              className="dashboard-refresh-btn"
              onClick={handleRefresh}
              title="Refresh spending data"
              aria-label="Refresh dashboard data"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="dashboard-alert" role="alert">
            {error}
          </div>
        )}

        {isLoading && <p className="dashboard-loading">Loading your spending data&hellip;</p>}

        {!isLoading && showEmptyState && (
          <section className="card dashboard-empty">
            <h2>No spending data yet</h2>
            <p className="card__text">Start by adding your first transaction.</p>
            <Link className="btn btn--primary" to="/transactions">
              Add Transaction
            </Link>
          </section>
        )}

        {!isLoading && hasData && (
          <>
            {/* KPI cards */}
            <div className="kpi-grid">
              <section className="card kpi-card">
                <h2>Total Spend</h2>
                <p className="kpi-card__value">{formatMoney(summary.totalSpend)}</p>
                <p className="kpi-card__trend">Total spending for selected period</p>
              </section>
              <section className="card kpi-card">
                <h2>Total Transactions</h2>
                <p className="kpi-card__value">{summary.transactionCount}</p>
                <p className="kpi-card__trend">{summary.transactionCount === 1 ? "1 recorded transaction" : `${summary.transactionCount} recorded transactions`}</p>
              </section>
              <section className="card kpi-card">
                <h2>Top Vendor</h2>
                <p className="kpi-card__value kpi-card__value--text">
                  {summary.topVendor ? summary.topVendor.name : "—"}
                </p>
                {summary.topVendor ? (
                  <p className="kpi-card__hint">{formatMoney(summary.topVendor.total)}</p>
                ) : (
                  <p className="kpi-card__trend">No vendor data</p>
                )}
              </section>
              <section className="card kpi-card">
                <h2>Top Category</h2>
                <p className="kpi-card__value kpi-card__value--text">
                  {summary.topCategory ? summary.topCategory.name : "—"}
                </p>
                {summary.topCategory ? (
                  <p className="kpi-card__hint">{formatMoney(summary.topCategory.total)}</p>
                ) : (
                  <p className="kpi-card__trend">No category data</p>
                )}
              </section>
            </div>

            {/* Charts Layout:
                1. Full-width Monthly Spending Line/Area chart
                2. Two-column row: Category Spending horizontal bars (left) & Department Spending ranked list (right)
            */}
            <div className="charts-container">
              {/* 1. Monthly Spending Line/Area Chart */}
              <section className="card chart-card chart-card--monthly">
                <div className="chart-card__header">
                  <div>
                    <h2>Monthly Spending</h2>
                    <p className="card__subtitle">Overview of organizational expenditure over time</p>
                  </div>
                  <span className="chart-card__badge">Monthly Trend</span>
                </div>

                {summary.monthlySpend && summary.monthlySpend.length === 1 ? (
                  <div className="chart-single-month">
                    <div className="chart-single-month__content">
                      <span className="chart-single-month__label">
                        {(() => {
                          const [year, month] = (summary.monthlySpend[0].name || "").split("-");
                          if (year && month) {
                            const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
                            return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
                          }
                          return summary.monthlySpend[0].name;
                        })()}
                      </span>
                      <span className="chart-single-month__value">
                        {formatMoney(summary.monthlySpend[0].total)}
                      </span>
                      <p className="chart-single-month__hint">
                        More monthly data will appear here as transactions are added over subsequent months.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="chart-card__canvas chart-card__canvas--monthly">
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart
                        data={summary.monthlySpend}
                        margin={{ top: 16, right: 24, left: 10, bottom: 8 }}
                      >
                        <defs>
                          <linearGradient id="spendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#dc2626" stopOpacity={0.12} />
                            <stop offset="100%" stopColor="#dc2626" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="name"
                          stroke="#64748b"
                          fontSize={12}
                          tickLine={false}
                          axisLine={{ stroke: "#e2e8f0" }}
                          dy={8}
                        />
                        <YAxis
                          stroke="#64748b"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(val) => {
                            if (val === 0) return "₹0";
                            if (val >= 100000) {
                              const lakhs = val / 100000;
                              return Number.isInteger(lakhs) ? `₹${lakhs}L` : `₹${lakhs.toFixed(1)}L`;
                            }
                            if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                            return `₹${val}`;
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "10px",
                            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.08)",
                            color: "var(--text)",
                            fontSize: "13px",
                            padding: "10px 14px",
                          }}
                          formatter={(value) => [formatMoney(value), "Monthly Spend"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="total"
                          name="Spend"
                          stroke="#dc2626"
                          strokeWidth={2.5}
                          fill="url(#spendAreaGradient)"
                          activeDot={{ r: 5, fill: "#dc2626", stroke: "#ffffff", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              {/* 2. Secondary Row: Category Horizontal Bars & Department Ranked List */}
              <div className="charts-breakdown-row">
                {/* Category Spending - Horizontal Bar Chart */}
                <section className="card chart-card chart-card--category">
                  <div className="chart-card__header">
                    <div>
                      <h2>Category Spending</h2>
                      <p className="card__subtitle">Expenditure categorized by spend type</p>
                    </div>
                  </div>
                  <div className="category-bars-list">
                    {(() => {
                      const sorted = [...(summary.categorySpend || [])].sort((a, b) => b.total - a.total);
                      const maxVal = sorted.length > 0 ? Math.max(...sorted.map((item) => item.total), 1) : 1;
                      return sorted.map((item, index) => {
                        const isTop = index === 0;
                        const pct = Math.min(100, Math.max(0, (item.total / maxVal) * 100));
                        return (
                          <div key={item.name} className="cat-bar-row">
                            <div className="cat-bar-label">
                              <span className="cat-bar-name" title={item.name}>{item.name}</span>
                            </div>
                            <div className="cat-bar-track">
                              <div
                                className={`cat-bar-fill ${isTop ? "cat-bar-fill--top" : "cat-bar-fill--other"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="cat-bar-amount">
                              {formatMoney(item.total)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </section>

                {/* Department Spending - Ranked List + Progress Bars */}
                <section className="card chart-card chart-card--department">
                  <div className="chart-card__header">
                    <div>
                      <h2>Department Spending</h2>
                      <p className="card__subtitle">Departmental breakdown and allocation</p>
                    </div>
                  </div>
                  <div className="dept-ranked-list">
                    {(() => {
                      const sorted = [...(summary.departmentSpend || [])].sort((a, b) => b.total - a.total);
                      const maxVal = sorted.length > 0 ? Math.max(...sorted.map((item) => item.total), 1) : 1;
                      return sorted.map((dept, index) => {
                        const isTop = index === 0;
                        const pct = Math.min(100, Math.max(0, (dept.total / maxVal) * 100));
                        return (
                          <div key={dept.name} className="dept-ranked-item">
                            <div className="dept-ranked-header">
                              <div className="dept-ranked-title-wrap">
                                <span className={`dept-rank-badge ${isTop ? "dept-rank-badge--top" : ""}`}>
                                  #{index + 1}
                                </span>
                                <span className="dept-ranked-name">{dept.name}</span>
                              </div>
                              <span className="dept-ranked-amount">{formatMoney(dept.total)}</span>
                            </div>
                            <div className="dept-progress-track">
                              <div
                                className={`dept-progress-fill ${isTop ? "dept-progress-fill--top" : "dept-progress-fill--other"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </section>
              </div>
            </div>

            {/* Recent transactions */}
            <section className="card recent-card">
              <div className="recent-card__head">
                <div>
                  <h2>Recent Transactions</h2>
                  <p className="card__subtitle">Latest spend activity across your organization</p>
                </div>
                <Link className="recent-card__view-all" to="/transactions">
                  View all &rarr;
                </Link>
              </div>
              <div className="recent-table-wrap">
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Vendor</th>
                      <th>Category</th>
                      <th>Department</th>
                      <th className="recent-table__amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td className="recent-table__date">{formatDate(tx.date)}</td>
                        <td className="recent-table__vendor">{tx.vendor}</td>
                        <td>
                          <span className="recent-table__tag">{tx.category}</span>
                        </td>
                        <td>
                          <span className="recent-table__tag">{tx.department || "Unassigned"}</span>
                        </td>
                        <td className="recent-table__amount">{formatMoney(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Budget vs Actual - visual budget card */}
            {budgetSummary && budgetSummary.budgetCount > 0 && (
              <section className="card budget-card">
                <div className="budget-card__head">
                  <div>
                    <h2>Budget vs Actual</h2>
                    <p className="card__subtitle">
                      {budgetSummary.budgetCount}{" "}
                      {budgetSummary.budgetCount === 1 ? "active budget" : "active budgets"} compared with actual transactions
                    </p>
                  </div>
                  <Link className="btn btn--ghost" to="/budget">
                    View details
                  </Link>
                </div>

                <div className="budget-card__flow">
                  <div className="budget-flow__item">
                    <span className="budget-flow__label">Total Budget</span>
                    <span className="budget-flow__value">
                      {formatMoney(budgetSummary.totals.totalBudget)}
                    </span>
                  </div>
                  <span className="budget-flow__arrow" aria-hidden="true">&rarr;</span>
                  <div className="budget-flow__item budget-flow__item--used">
                    <span className="budget-flow__label">Used Spend</span>
                    <span className="budget-flow__value">
                      {formatMoney(budgetSummary.totals.actualSpend)}
                    </span>
                  </div>
                  <span className="budget-flow__arrow" aria-hidden="true">&rarr;</span>
                  <div className="budget-flow__item">
                    <span className="budget-flow__label">Remaining</span>
                    <span className="budget-flow__value">
                      {formatMoney(budgetSummary.totals.remainingBudget)}
                    </span>
                  </div>
                </div>

                <div className="budget-progress-section">
                  <div className="budget-progress__info">
                    <span className="budget-progress__label">Budget Utilized</span>
                    <span className="budget-progress__percentage">
                      {Number(budgetSummary.totals.usagePercentage || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="budget-progress__track" role="progressbar" aria-valuenow={Math.min(100, Math.max(0, Number(budgetSummary.totals.usagePercentage || 0)))} aria-valuemin="0" aria-valuemax="100">
                    <div
                      className="budget-progress__fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, Number(budgetSummary.totals.usagePercentage || 0)))}%`,
                      }}
                    />
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Basic unusual spending alerts (rule-based, real data) */}
        <UnusualSpending range={range} from={customFrom} to={customTo} />

        {/* Automatic spend insights - follows the dashboard's own date filter. */}
        <SpendInsights range={range} from={customFrom} to={customTo} />
      </main>
    </div>
  );
}

export default Dashboard;

