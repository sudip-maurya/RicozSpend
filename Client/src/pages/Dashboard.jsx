import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
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
  { value: "quarter", label: "This Quarter" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

/**
 * Dashboard (Part 3: real spend overview backed by /api/dashboard/summary).
 * Protected by the Part 2 authentication; works for Admin and Viewer alike.
 */
function Dashboard() {
  const { user } = useAuth();

  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Part 9: Budget vs Actual totals (only rendered when a budget exists).
  // Loaded once - budgets are monthly, so they are independent of the
  // dashboard's own date filter.
  const [budgetSummary, setBudgetSummary] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadBudgetSummary = async () => {
      const result = await fetchBudgetComparison();

      // A missing/failed budget comparison simply hides the section - the rest
      // of the dashboard keeps working.
      if (!isActive) return;
      setBudgetSummary(result.error ? null : result.data);
    };

    loadBudgetSummary();

    return () => {
      isActive = false;
    };
  }, []);

  // Fetch the summary whenever the date filter changes. Follows the same
  // in-effect async + isActive guard pattern as AuthProvider (Part 2).
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
  }, [range, customFrom, customTo]);

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

          <div className="date-filter" role="group" aria-label="Dashboard date filter">
            <select
              className="date-filter__select"
              value={range}
              onChange={handleRangeChange}
              aria-label="Date range"
            >
              {DATE_RANGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
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
              </section>
              <section className="card kpi-card">
                <h2>Total Transactions</h2>
                <p className="kpi-card__value">{summary.transactionCount}</p>
              </section>
              <section className="card kpi-card">
                <h2>Top Vendor</h2>
                <p className="kpi-card__value kpi-card__value--text">
                  {summary.topVendor ? summary.topVendor.name : "—"}
                </p>
                {summary.topVendor && (
                  <p className="kpi-card__hint">{formatMoney(summary.topVendor.total)}</p>
                )}
              </section>
              <section className="card kpi-card">
                <h2>Top Category</h2>
                <p className="kpi-card__value kpi-card__value--text">
                  {summary.topCategory ? summary.topCategory.name : "—"}
                </p>
                {summary.topCategory && (
                  <p className="kpi-card__hint">{formatMoney(summary.topCategory.total)}</p>
                )}
              </section>
            </div>

            {/* Charts */}
            <div className="chart-grid">
              <section className="card chart-card">
                <h2>Monthly Spending</h2>
                <div className="chart-card__canvas">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.monthlySpend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
                      <YAxis stroke="var(--text)" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="total" name="Spend" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card chart-card">
                <h2>Category Spending</h2>
                <div className="chart-card__canvas">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.categorySpend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
                      <YAxis stroke="var(--text)" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="total" name="Spend" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card chart-card">
                <h2>Department Spending</h2>
                <div className="chart-card__canvas">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={summary.departmentSpend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
                      <YAxis stroke="var(--text)" fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="total" name="Spend" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            {/* Recent transactions */}
            <section className="card recent-card">
              <h2>Recent Transactions</h2>
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
                        <td>{formatDate(tx.date)}</td>
                        <td>{tx.vendor}</td>
                        <td>{tx.category}</td>
                        <td>{tx.department || "Unassigned"}</td>
                        <td className="recent-table__amount">{formatMoney(tx.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Part 9: Budget vs Actual - only shown once a budget exists, so it
                never adds another empty state to the dashboard. */}
            {budgetSummary && budgetSummary.budgetCount > 0 && (
              <section className="card recent-card">
                <div className="alerts-head">
                  <h2>Budget vs Actual</h2>
                  <Link className="btn btn--ghost" to="/budget">
                    View details
                  </Link>
                </div>

                <div className="alerts-summary">
                  <div className="alerts-summary__item">
                    <span className="alerts-summary__label">Total Budget</span>
                    <span className="alerts-summary__value">
                      {formatMoney(budgetSummary.totals.totalBudget)}
                    </span>
                  </div>
                  <div className="alerts-summary__item">
                    <span className="alerts-summary__label">Actual Spend</span>
                    <span className="alerts-summary__value">
                      {formatMoney(budgetSummary.totals.actualSpend)}
                    </span>
                  </div>
                  <div className="alerts-summary__item">
                    <span className="alerts-summary__label">Remaining Budget</span>
                    <span className="alerts-summary__value">
                      {formatMoney(budgetSummary.totals.remainingBudget)}
                    </span>
                  </div>
                  <div className="alerts-summary__item">
                    <span className="alerts-summary__label">Budget Usage</span>
                    <span className="alerts-summary__value">
                      {Number(budgetSummary.totals.usagePercentage || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <p className="card__text">
                  {budgetSummary.budgetCount}{" "}
                  {budgetSummary.budgetCount === 1 ? "budget" : "budgets"} compared with actual
                  spending from transactions.
                </p>
              </section>
            )}
          </>

        )}

        {/* Part 7: basic unusual spending alerts (rule-based, real data) */}
        <UnusualSpending range={range} from={customFrom} to={customTo} />

        {/* Part 8: automatic spend insights - follows the dashboard's own date
            filter (no second filtering system). */}
        <SpendInsights range={range} from={customFrom} to={customTo} />
      </main>
    </div>
  );
}

export default Dashboard;

