import { useCallback, useEffect, useRef, useState } from "react";

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
import NavBar from "../components/NavBar";
import { useAuth } from "../context/authContext";
import { deleteBudget, fetchBudgetComparison } from "../services/budgetService";
import { formatMoney } from "../utils/format";
import "../styles/dashboard.css";
import "../styles/transactions.css";

const EMPTY_FILTERS = { period: "", department: "", category: "" };

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

/**
 * Budget vs Actual page (Part 9).
 *
 * Planned budgets stored in the Budget collection are compared against the
 * actual spend of the authenticated user's EXISTING transactions, all computed
 * by /api/budgets/comparison. The page is descriptive only: no ranking,
 * scoring or recommendations.
 *
 * Viewer: read-only. Admin: add / edit / delete (the backend enforces the role
 * with requireRole("Admin")); the UI simply hides the controls it may not use.
 */
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

  const moneyTooltip = (value) => formatMoney(value);

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="txn-toolbar">
          <div>
            <h1 className="page-title">Budget vs Actual</h1>
            <p className="page-subtitle">
              Planned budget compared with actual spend from your transactions.
            </p>
          </div>

          {isAdmin && (
            <div className="txn-toolbar__actions">
              <button type="button" className="btn" onClick={() => setFormTarget({})}>
                + Add Budget
              </button>
            </div>
          )}
        </div>

        {toast && <div className="alert alert--success">{toast}</div>}

        {/* Filters: month / period + cost centre + category */}
        <section className="card">
          <div className="txn-filters">
            <div className="form-field">
              <label className="form-field__label" htmlFor="budget-filter-period">
                Month / Period
              </label>
              <input
                id="budget-filter-period"
                className="txn-filter__date"
                type="month"
                value={filters.period}
                onChange={(event) => updateFilter("period", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="budget-filter-department">
                Cost Centre / Department
              </label>
              <select
                id="budget-filter-department"
                className="txn-filter__select"
                value={filters.department}
                onChange={(event) => updateFilter("department", event.target.value)}
              >
                <option value="">All departments</option>
                {facets.departments.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="budget-filter-category">
                Category
              </label>
              <select
                id="budget-filter-category"
                className="txn-filter__select"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
              >
                <option value="">All categories</option>
                {facets.categories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          <p className="txn-form__hint">
            Leave the month blank to compare every period. Actual spend is always read from your
            existing transactions.
          </p>
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
            <div className="kpi-grid">
              <section className="card kpi-card">
                <h2>Total Budget</h2>
                <p className="kpi-card__value">{formatMoney(totals.totalBudget)}</p>
              </section>
              <section className="card kpi-card">
                <h2>Actual Spend</h2>
                <p className="kpi-card__value">{formatMoney(totals.actualSpend)}</p>
              </section>
              <section className="card kpi-card">
                <h2>Remaining Budget</h2>
                <p className="kpi-card__value">{formatMoney(totals.remainingBudget)}</p>
              </section>
              <section className="card kpi-card">
                <h2>Budget Usage</h2>
                <p className="kpi-card__value">{formatPercentage(totals.usagePercentage)}</p>
                <p className="kpi-card__hint">Actual spend as a share of the total budget</p>
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

