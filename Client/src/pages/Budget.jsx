import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import BudgetFormModal from "../components/BudgetFormModal";
import Dropdown from "../components/Dropdown";
import NavBar from "../components/NavBar";
import { useAuth } from "../context/authContext";
import { deleteBudget, fetchBudgetComparison } from "../services/budgetService";
import { formatMoney, formatShortMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/transactions.css";
import "../styles/budget.css";

const EMPTY_FILTERS = { period: "", department: "", category: "" };

/** "2026-09" -> "September 2026" */
const formatMonthLabel = (period) => {
  if (!period || typeof period !== "string") return "";
  const parts = period.split("-");
  if (parts.length !== 2) return period;
  const [year, month] = parts;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const idx = parseInt(month, 10) - 1;
  return `${monthNames[idx] || month} ${year}`;
};

/** Server status label -> existing badge variant. */
const STATUS_CLASS = {
  "On Track": "budget-status--under",
  "Warning": "budget-status--near",
  "Critical": "budget-status--critical",
  "Over Budget": "budget-status--over",
  "Under Budget": "budget-status--under",
  "Near Budget": "budget-status--near",
};

/** 72.46 -> "72.46%" (display only). */
const formatPercentage = (value) => {
  const percentage = Number(value);

  return Number.isFinite(percentage) ? `${percentage.toFixed(2)}%` : "—";
};

/** +₹5,000 / -₹2,500 - variance is actual - budget. */
const formatVariance = (value) => {
  const variance = Number(value);

  if (!Number.isFinite(variance)) return "—";

  return `${variance > 0 ? "+" : ""}${formatMoney(variance)}`;
};

/** Chart label: "Technology" or "Technology · IT" when a category is set. */
const chartLabel = (row) => (row.category ? `${row.department} · ${row.category}` : row.department);

/** Budget vs Actual page (Part 9). */
function Budget() {
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Modals / dialogs
  const [formTarget, setFormTarget] = useState(null); // {} = add, row = edit
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Temporary success / error feedback (same pattern as Part 4)
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Destructured into primitives so the effect re-runs only on real changes.
  const { period, department, category } = filters;

  // Same in-effect async + isActive guard pattern as the other pages.
  useEffect(() => {
    let isActive = true;

    const loadComparison = async () => {
      setIsLoading(true);
      setError("");

      const result = await fetchBudgetComparison({ period, department, category });

      if (!isActive) return;

      if (result.error) {
        setData(null);
        setError(result.error);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    loadComparison();

    return () => {
      isActive = false;
    };
  }, [period, department, category, reloadKey]);

  // Re-fetch so budget/actual values always reflect the latest transactions.
  const refresh = () => setReloadKey((key) => key + 1);

  const updateFilter = (name, value) => setFilters((current) => ({ ...current, [name]: value }));

  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    const result = await deleteBudget(deleteTarget.id);

    setIsDeleting(false);

    if (result.error) {
      showToast(result.error);
      return;
    }

    setDeleteTarget(null);
    showToast("Budget deleted successfully.");
    refresh();
  };

  const rows = data?.rows || [];
  const totals = data?.totals || null;
  const facets = data?.facets || { departments: [], categories: [] };
  const chartData = rows.map((row) => ({
    name: chartLabel(row),
    budget: row.budget,
    actual: row.actual,
  }));

  const monthOptions = useMemo(() => {
    const periodSet = new Set();
    (rows || []).forEach((row) => {
      if (row.period) periodSet.add(row.period);
    });
    const now = new Date();
    for (let i = -1; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      periodSet.add(`${y}-${m}`);
    }
    const sorted = Array.from(periodSet).sort().reverse();
    return [
      { value: "", label: "Select month" },
      ...sorted.map((p) => ({
        value: p,
        label: formatMonthLabel(p),
      })),
    ];
  }, [rows]);

  const totalBudget = totals?.totalBudget || 0;
  const actualSpend = totals?.actualSpend || 0;
  const remainingBudget = totals?.remainingBudget ?? (totalBudget - actualSpend);
  const usedPercent = totalBudget > 0 ? (actualSpend / totalBudget) * 100 : 0;
  const remainingPercent = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;
  const isOverBudget = usedPercent > 100;
  const progressWidth = Math.min(Math.max(usedPercent, 0), 100);

  const moneyTooltip = (value) => formatMoney(value);

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="txn-toolbar bva-header">
          <div className="bva-header__left">
            <h1 className="page-title bva-title">Budget vs Actual</h1>
            <p className="page-subtitle bva-subtitle">
              Track planned budget against actual spending.
            </p>
          </div>

          {isAdmin && (
            <div className="txn-toolbar__actions">
              <button
                type="button"
                className="btn btn--primary bva-add-btn"
                onClick={() => setFormTarget({})}
              >
                + Add Budget
              </button>
            </div>
          )}
        </div>

        {toast && <div className="alert alert--success">{toast}</div>}

        {/* Filters: month / period + cost centre + category */}
        <section className="card bva-filter-card" aria-label="Budget filters">
          <div className="bva-filters-row">
            <div className="bva-filter-group">
              <label className="bva-filter-label" htmlFor="budget-filter-period">
                Month / Period
              </label>
              <Dropdown
                id="budget-filter-period"
                value={filters.period}
                onChange={(event) => updateFilter("period", event.target.value)}
                options={monthOptions}
                placeholder="Select month"
              />
            </div>

            <div className="bva-filter-group">
              <label className="bva-filter-label" htmlFor="budget-filter-department">
                Department
              </label>
              <Dropdown
                id="budget-filter-department"
                value={filters.department}
                onChange={(event) => updateFilter("department", event.target.value)}
                options={[
                  { value: "", label: "All departments" },
                  ...facets.departments.map((option) => ({
                    value: option,
                    label: option,
                  })),
                ]}
              />
            </div>

            <div className="bva-filter-group">
              <label className="bva-filter-label" htmlFor="budget-filter-category">
                Category
              </label>
              <Dropdown
                id="budget-filter-category"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
                options={[
                  { value: "", label: "All categories" },
                  ...facets.categories.map((option) => ({
                    value: option,
                    label: option,
                  })),
                ]}
              />
            </div>
          </div>

          <div className="bva-filter-footer">
            <span className="bva-filter-hint">
              Compare your planned budget with actual transaction spend.
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn--ghost bva-reset-btn"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        {isLoading && <p className="dashboard-loading">Loading budget comparison&hellip;</p>}

        {!isLoading && error && (
          <section className="card">
            <div className="txn-state txn-state--error">{error}</div>
            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={refresh}>
                Retry
              </button>
            </div>
          </section>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <section className="card dashboard-empty">
            <h2>Budget vs Actual</h2>
            <p className="card__text">
              {hasActiveFilters
                ? "No budgets match the selected filters."
                : "No budgets yet. Add a budget to compare planned spend with actual transactions."}
            </p>
            {isAdmin && (
              <button type="button" className="btn" onClick={() => setFormTarget({})}>
                + Add Budget
              </button>
            )}
            {hasActiveFilters && (
              <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </section>
        )}

        {!isLoading && !error && totals && rows.length > 0 && (
          <>
            <div className="kpi-grid bva-kpi-grid">
              <section className="card kpi-card bva-kpi-card">
                <span className="bva-kpi-label">TOTAL BUDGET</span>
                <p className="kpi-card__value bva-kpi-value">{formatMoney(totalBudget)}</p>
                <p className="bva-kpi-caption">Planned spending</p>
              </section>

              <section className="card kpi-card bva-kpi-card">
                <span className="bva-kpi-label">ACTUAL SPEND</span>
                <p className="kpi-card__value bva-kpi-value">{formatMoney(actualSpend)}</p>
                <p className="bva-kpi-caption">
                  {usedPercent.toFixed(2)}% of budget used
                </p>
              </section>

              <section className="card kpi-card bva-kpi-card">
                <span className="bva-kpi-label">REMAINING BUDGET</span>
                <p className="kpi-card__value bva-kpi-value">{formatMoney(remainingBudget)}</p>
                <p className="bva-kpi-caption">
                  {remainingBudget >= 0
                    ? `${remainingPercent.toFixed(2)}% of budget remaining`
                    : `${Math.abs(remainingPercent).toFixed(2)}% over budget`}
                </p>
              </section>

              <section
                className={`card kpi-card bva-kpi-card bva-kpi-card--highlight ${
                  isOverBudget ? "bva-kpi-card--over" : ""
                }`}
              >
                <div className="bva-kpi-header">
                  <span className="bva-kpi-label">BUDGET USAGE</span>
                  {isOverBudget && (
                    <span className="bva-overbudget-badge">Over budget</span>
                  )}
                </div>

                <p className="bva-kpi-value bva-kpi-value--accent">
                  {usedPercent.toFixed(2)}%
                </p>

                <div className="bva-progress-wrap" aria-hidden="true">
                  <div
                    className={`bva-progress-bar ${isOverBudget ? "is-over" : ""}`}
                    style={{ width: `${progressWidth}%` }}
                  />
                </div>

                <div className="bva-progress-stats">
                  <span>
                    {formatShortMoney(actualSpend)} of {formatShortMoney(totalBudget)}
                  </span>
                  <span>
                    {remainingBudget >= 0
                      ? `${formatShortMoney(remainingBudget)} remaining`
                      : `${formatShortMoney(Math.abs(remainingBudget))} over budget`}
                  </span>
                </div>
              </section>
            </div>

            <section className="card chart-card">
              <h2>Budget vs Actual by Cost Centre</h2>
              <div className="chart-card__canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--text)" fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--text)"
                      fontSize={12}
                      width={130}
                    />
                    <Tooltip formatter={moneyTooltip} />
                    <Legend />
                    <Bar
                      dataKey="budget"
                      name="Budget"
                      fill="var(--accent)"
                      radius={[0, 4, 4, 0]}
                    />
                    <Bar
                      dataKey="actual"
                      name="Actual"
                      fill="var(--success)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="card">
              <div className="alerts-head">
                <h2>Budget Comparison</h2>
                <span className="alerts-badge">
                  {data.budgetCount} {data.budgetCount === 1 ? "Budget" : "Budgets"}
                </span>
              </div>

              <div className="recent-table-wrap">
                <table className="recent-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Category</th>
                      <th>Period</th>
                      <th className="recent-table__amount">Budget</th>
                      <th className="recent-table__amount">Actual</th>
                      <th className="recent-table__amount">Variance</th>
                      <th className="recent-table__amount">Usage %</th>
                      <th>Status</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.department}</td>
                        <td>{row.category || "—"}</td>
                        <td>{row.period}</td>
                        <td className="recent-table__amount">{formatMoney(row.budget)}</td>
                        <td className="recent-table__amount">{formatMoney(row.actual)}</td>
                        <td className="recent-table__amount">{formatVariance(row.variance)}</td>
                        <td className="recent-table__amount">
                          <span className="vendor-compare__share-value">
                            {formatPercentage(row.usagePercentage)}
                          </span>
                        </td>
                        <td>
                          <span className={`budget-status ${STATUS_CLASS[row.status] || ""}`}>
                            {row.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            {deleteTarget?.id === row.id ? (
                              <span className="txn-table__actions">
                                <button
                                  type="button"
                                  className="btn btn--danger"
                                  onClick={handleDelete}
                                  disabled={isDeleting}
                                >
                                  {isDeleting ? "Deleting..." : "Yes, delete"}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() => setDeleteTarget(null)}
                                  disabled={isDeleting}
                                >
                                  No
                                </button>
                              </span>
                            ) : (
                              <span className="txn-table__actions">
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() => setFormTarget(row)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--danger"
                                  onClick={() => setDeleteTarget(row)}
                                >
                                  Delete
                                </button>
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="txn-form__hint">
                Variance = Actual − Budget. Usage % = Actual ÷ Budget × 100. Actual values come from
                your transactions and update automatically.
              </p>
            </section>
          </>
        )}

        {/* Add / Edit budget (Admin only - keyed so the form always restarts) */}
        {isAdmin && formTarget !== null && (
          <BudgetFormModal
            key={formTarget.id || "add"}
            budget={formTarget.id ? formTarget : null}
            facets={facets}
            onClose={() => setFormTarget(null)}
            onSaved={(message) => {
              setFormTarget(null);
              showToast(message);
              refresh(); // re-compute actual spend from the current transactions
            }}
          />
        )}
      </main>
    </div>
  );
}

export default Budget;

