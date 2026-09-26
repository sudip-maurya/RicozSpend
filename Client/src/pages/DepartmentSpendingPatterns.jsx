import { useEffect, useState } from "react";

import NavBar from "../components/NavBar";
import DepartmentSpending from "../components/DepartmentSpending";
import { fetchAnalyticsSummary } from "../services/analyticsService";
import "../styles/dashboard.css";
import "../styles/transactions.css";

const EMPTY_FILTERS = { from: "", to: "", category: "", department: "" };

/**
 * Department Spending Patterns page (Part 13).
 *
 * Dedicated page for the Part 10 section: date range + category + department
 * filters on top, then the shared <DepartmentSpending /> section with its
 * bar chart (X = department, Y = total spend), summary stats (total spend,
 * transactions, highest-spending department, average per department) and the
 * breakdown table (department / total spend / transaction count / % of total).
 *
 * Everything is read-only for every role (Admin and Viewer alike): the page
 * only calls GET /api/analytics/* against the existing shared transaction
 * data - there is no create/edit/delete control anywhere, and the backend
 * endpoint has no write routes.
 *
 * Filter dropdown options come from the existing analytics summary facets
 * (scope-based, independent of the active filters), the same way the Spend
 * Analysis page builds its dropdowns - no duplicate department data.
 */
function DepartmentSpendingPatterns() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  // Facet options for the Category / Department dropdowns. Loaded once on
  // mount: the facets are scoped distinct values (not filter-dependent), and
  // the actual filtering happens server-side inside the section below.
  const [facets, setFacets] = useState({ categories: [], departments: [] });

  useEffect(() => {
    let isActive = true;

    const loadFacets = async () => {
      const result = await fetchAnalyticsSummary();

      if (!isActive || result.error || !result.data?.facets) return;

      setFacets({
        categories: result.data.facets.categories || [],
        departments: result.data.facets.departments || [],
      });
    };

    loadFacets();

    return () => {
      isActive = false;
    };
  }, []);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const resetFilters = () => setFilters(EMPTY_FILTERS);

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="dashboard-head">
          <div>
            <h1 className="page-title">Department Spending Patterns</h1>
            <p className="page-subtitle">
              Total spend, share and averages for every department - calculated from your
              transactions.
            </p>
          </div>
        </div>

        {/* Filters: date range + category + department (same controls as Part 4/6) */}
        <section className="card">
          <div className="txn-filters">
            <div className="form-field">
              <label className="form-field__label" htmlFor="dept-from">
                From Date
              </label>
              <input
                id="dept-from"
                className="txn-filter__date"
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => updateFilter("from", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="dept-to">
                To Date
              </label>
              <input
                id="dept-to"
                className="txn-filter__date"
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => updateFilter("to", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="dept-category">
                Category
              </label>
              <select
                id="dept-category"
                className="txn-filter__select"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
              >
                <option value="">All</option>
                {facets.categories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="dept-department">
                Department
              </label>
              <select
                id="dept-department"
                className="txn-filter__select"
                value={filters.department}
                onChange={(event) => updateFilter("department", event.target.value)}
              >
                <option value="">All</option>
                {facets.departments.map((option) => (
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

        {/* Shared read-only section (Part 10) with the Part 13 chart opted in.
            It owns its own loading / error / empty states and re-fetches
            whenever the filters above change. */}
        <DepartmentSpending filters={filters} showChart />
      </main>
    </div>
  );
}

export default DepartmentSpendingPatterns;