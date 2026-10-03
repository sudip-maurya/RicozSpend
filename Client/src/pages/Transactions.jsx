import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import NavBar from "../components/NavBar";
import TransactionFormModal from "../components/TransactionFormModal";
import TransactionImportModal from "../components/TransactionImportModal";
import TransactionViewModal from "../components/TransactionViewModal";
import { useAuth } from "../context/authContext";
import {
  deleteTransaction,
  exportTransactionsCsv,
  fetchTransactions,
} from "../services/transactionService";
import { formatMoney, formatDate } from "../utils/format";
import "./../styles/transactions.css";

const PAGE_SIZES = [10, 20];

/** Build the API query object from the current filter state (skips empties). */
const buildQuery = (filters) => {
  const query = {
    page: filters.page,
    limit: filters.limit,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };

  if (filters.search.trim()) query.search = filters.search.trim();
  if (filters.category) query.category = filters.category;
  if (filters.department) query.department = filters.department;
  if (filters.vendor) query.vendor = filters.vendor;
  if (filters.minAmount !== "" && filters.minAmount !== undefined)
    query.minAmount = filters.minAmount;
  if (filters.maxAmount !== "" && filters.maxAmount !== undefined)
    query.maxAmount = filters.maxAmount;
  if (filters.from) query.from = filters.from;
  if (filters.to) query.to = filters.to;

  return query;
};

const DEFAULT_FILTERS = {
  search: "",
  category: "",
  department: "",
  vendor: "",
  minAmount: "",
  maxAmount: "",
  from: "",
  to: "",
  sortBy: "date",
  sortOrder: "desc",
  page: 1,
  limit: 10,
};

const EMPTY_DATA = {
  transactions: [],
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  facets: { categories: [], departments: [], vendors: [] },
};

/** Spend / Transactions page (Part 4). */
function Transactions() {
  const { isAdmin } = useAuth();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState(""); // debounced into filters.search
  const [data, setData] = useState(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals / dialogs
  const [formTarget, setFormTarget] = useState(null); // {} = add, transaction = edit
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false); // Part 5: CSV import
  const [isExporting, setIsExporting] = useState(false); // P2-10: CSV export

  // Temporary success / error feedback
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // P2-10: download the filtered transactions as CSV (same filters as the list).
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const exportFilters = { ...buildQuery(filters) };
    delete exportFilters.page;
    delete exportFilters.limit;
    const { error } = await exportTransactionsCsv(exportFilters);
    setIsExporting(false);
    if (error) {
      showToast(error);
    } else {
      showToast("Transactions exported as CSV.");
    }
  };

  // Debounce the search box so we do not query the API on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) =>
        current.search === searchInput
          ? current
          : { ...current, search: searchInput, page: 1 }
      );
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load the transaction list whenever any filter/sort/page changes.
  useEffect(() => {
    let isActive = true;

    const loadTransactions = async () => {
      setIsLoading(true);
      setError("");

      const result = await fetchTransactions(buildQuery(filters));

      if (!isActive) return;

      if (result.error) {
        setData(EMPTY_DATA);
        setError(result.error);
      } else {
        setData(result.data);
      }

      setIsLoading(false);
    };

    loadTransactions();

    return () => {
      isActive = false;
    };
  }, [filters]);

  const updateFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value, page: 1 }));
  };

  const handleSort = (field) => {
    setFilters((current) => ({
      ...current,
      sortBy: field,
      sortOrder:
        current.sortBy === field && current.sortOrder === "desc" ? "asc" : "desc",
      page: 1,
    }));
  };

  const clearFilters = () => {
    setSearchInput("");
    setSliderRange({ min: 10000, max: 50000 });
    setFilters((current) => ({
      ...DEFAULT_FILTERS,
      limit: current.limit, // keep the chosen page size
    }));
  };

  const handleApplyFilters = () => {
    setFilters((current) => ({
      ...current,
      search: searchInput.trim(),
      minAmount: sliderRange.min,
      maxAmount: sliderRange.max,
      page: 1,
    }));
  };

  const hasActiveFilters =
    Boolean(filters.search.trim()) ||
    Boolean(filters.category) ||
    Boolean(filters.department) ||
    Boolean(filters.vendor) ||
    filters.minAmount !== "" ||
    filters.maxAmount !== "" ||
    Boolean(filters.from) ||
    Boolean(filters.to);

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);

    const result = await deleteTransaction(deleteTarget.id);

    setIsDeleting(false);

    if (result.error) {
      showToast(result.error);
    } else {
      showToast("Transaction deleted successfully.");
      setDeleteTarget(null);

      // If the last row of a page was deleted, step back one page.
      const remaining = data.total - 1;
      const maxPage = Math.max(Math.ceil(remaining / data.limit), 1);
      if (data.page > maxPage) {
        setFilters((current) => ({ ...current, page: maxPage }));
      } else {
        setFilters((current) => ({ ...current })); // re-trigger the fetch
      }
    }
  };

  const SLIDER_MAX = 100000;

  // Local state for the slider handles while dragging (zero page flicker)
  const [sliderRange, setSliderRange] = useState({
    min: filters.minAmount !== "" ? Number(filters.minAmount) : 10000,
    max: filters.maxAmount !== "" ? Number(filters.maxAmount) : 50000,
  });

  // Sync local slider state when external filters change (e.g. Reset button)
  useEffect(() => {
    setSliderRange({
      min: filters.minAmount !== "" ? Number(filters.minAmount) : 10000,
      max: filters.maxAmount !== "" ? Number(filters.maxAmount) : 50000,
    });
  }, [filters.minAmount, filters.maxAmount]);

  // Commit changes to actual filters when drag ends or debounced (~250ms)
  const commitSliderRange = useCallback(() => {
    setFilters((current) => {
      if (
        current.minAmount === sliderRange.min &&
        current.maxAmount === sliderRange.max
      ) {
        return current;
      }
      return {
        ...current,
        minAmount: sliderRange.min,
        maxAmount: sliderRange.max,
        page: 1,
      };
    });
  }, [sliderRange.min, sliderRange.max]);

  // Debounce filter commit so continuous dragging never re-filters per pixel
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => {
        if (
          current.minAmount === sliderRange.min &&
          current.maxAmount === sliderRange.max
        ) {
          return current;
        }
        return {
          ...current,
          minAmount: sliderRange.min,
          maxAmount: sliderRange.max,
          page: 1,
        };
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [sliderRange.min, sliderRange.max]);

  const minPercent = Math.min(100, Math.max(0, (sliderRange.min / SLIDER_MAX) * 100));
  const maxPercent = Math.min(100, Math.max(0, (sliderRange.max / SLIDER_MAX) * 100));

  const formatK = (amt) => {
    const num = Number(amt) || 0;
    if (num >= 1000) return `₹${Math.round(num / 1000)}K`;
    return `₹${num}`;
  };

  const displayRangeText = `${formatK(sliderRange.min)} – ${formatK(sliderRange.max)}`;

  const handleMinSliderChange = (e) => {
    const val = Math.min(Number(e.target.value), sliderRange.max);
    setSliderRange((prev) => ({ ...prev, min: val }));
  };

  const handleMaxSliderChange = (e) => {
    const val = Math.max(Number(e.target.value), sliderRange.min);
    setSliderRange((prev) => ({ ...prev, max: val }));
  };

  const firstRow = data.total === 0 ? 0 : (data.page - 1) * data.limit + 1;
  const lastRow = Math.min(data.page * data.limit, data.total);

  // Memoize rendered table rows so dragging the slider causes ZERO row recomputations
  const renderedTransactionRows = useMemo(() => {
    return data.transactions.map((transaction) => (
      <tr key={transaction.id} className="txn-table-row">
        <td className="txn-td-date">{formatDate(transaction.date)}</td>
        <td className="txn-td-vendor">
          <button
            type="button"
            className="txn-vendor-btn"
            onClick={() => setViewTarget(transaction)}
          >
            {transaction.vendor}
          </button>
        </td>
        <td className="txn-td-plain txn-td-category">{transaction.category}</td>
        <td className="txn-td-plain txn-td-dept">{transaction.department}</td>
        <td className="txn-td-amount">{formatMoney(transaction.amount)}</td>
        <td className="txn-td-actions">
          {isAdmin ? (
            deleteTarget?.id === transaction.id ? (
              <div className="txn-delete-confirm-box">
                <button
                  type="button"
                  className="txn-act-btn txn-act-btn--confirm-del"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  type="button"
                  className="txn-act-btn txn-act-btn--cancel"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  No
                </button>
              </div>
            ) : (
              <div className="txn-actions-flex">
                <button
                  type="button"
                  className="txn-act-btn txn-act-btn--view"
                  onClick={() => setViewTarget(transaction)}
                >
                  View
                </button>
                <button
                  type="button"
                  className="txn-act-btn txn-act-btn--edit"
                  onClick={() => setFormTarget(transaction)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="txn-act-btn txn-act-btn--delete"
                  onClick={() => setDeleteTarget(transaction)}
                >
                  Delete
                </button>
              </div>
            )
          ) : (
            <div className="txn-actions-flex">
              <button
                type="button"
                className="txn-act-btn txn-act-btn--view"
                onClick={() => setViewTarget(transaction)}
              >
                View
              </button>
            </div>
          )}
        </td>
      </tr>
    ));
  }, [data.transactions, isAdmin, deleteTarget?.id, isDeleting]);

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main txn-main-layout">
        {/* HEADER: Title, Subtitle, and Buttons */}
        <div className="txn-page-header">
          <div className="txn-page-header__left">
            <h1 className="txn-page-title">Spend / Transactions</h1>
            <p className="txn-page-subtitle">Manage your spending records</p>
          </div>

          <div className="txn-page-header__actions">
            {isAdmin && (
              <button
                type="button"
                className="txn-btn txn-btn--primary"
                onClick={() => setFormTarget({})}
              >
                + Add Transaction
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                className="txn-btn txn-btn--outline"
                onClick={() => setIsImportOpen(true)}
              >
                Import CSV
              </button>
            )}
            <button
              type="button"
              className="txn-btn txn-btn--outline"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {/* FILTER BAR: Exactly matching reference layout */}
        <section className="txn-filter-card">
          {/* (a) search + 3 labeled dropdown cards */}
          <div className="txn-filter-col txn-filter-col--left">
            <div className="txn-filter-search">
              <svg
                className="txn-filter-search__icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="txn-filter-search__input"
                type="search"
                placeholder="Search by category, department, vendor, id..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleApplyFilters();
                }}
                aria-label="Search transactions"
              />
            </div>

            <div className="txn-filter-dropdowns-row">
              <div className="txn-filter-select-box">
                <span className="txn-filter-select-box__label">CATEGORY</span>
                <select
                  id="filter-category"
                  className="txn-filter-select-box__input"
                  value={filters.category}
                  onChange={(event) => updateFilter("category", event.target.value)}
                  aria-label="Category"
                >
                  <option value="">All Categories</option>
                  {data.facets.categories.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <svg
                  className="txn-filter-select-box__chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              <div className="txn-filter-select-box">
                <span className="txn-filter-select-box__label">DEPARTMENT</span>
                <select
                  id="filter-department"
                  className="txn-filter-select-box__input"
                  value={filters.department}
                  onChange={(event) => updateFilter("department", event.target.value)}
                  aria-label="Department"
                >
                  <option value="">All Departments</option>
                  {data.facets.departments.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <svg
                  className="txn-filter-select-box__chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              <div className="txn-filter-select-box">
                <span className="txn-filter-select-box__label">VENDOR</span>
                <select
                  id="filter-vendor"
                  className="txn-filter-select-box__input"
                  value={filters.vendor}
                  onChange={(event) => updateFilter("vendor", event.target.value)}
                  aria-label="Vendor"
                >
                  <option value="">All Vendors</option>
                  {data.facets.vendors.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <svg
                  className="txn-filter-select-box__chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>

          {/* (b) Spending Range: SPENDING RANGE & ₹10K - ₹50K top, slider, ₹10,000 / ₹50,000 bottom */}
          <div className="txn-filter-col txn-filter-col--slider">
            <div className="txn-filter-slider-header">
              <span className="txn-filter-col-label">SPENDING RANGE</span>
              <span className="txn-filter-slider-pill">{displayRangeText}</span>
            </div>
            <div className="txn-filter-slider-body">
              <div className="txn-dual-slider">
                <div className="txn-dual-slider__track" />
                <div
                  className="txn-dual-slider__fill"
                  style={{
                    transform: `translate3d(${minPercent}%, 0, 0) scaleX(${Math.max(
                      0,
                      (maxPercent - minPercent) / 100
                    )})`,
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max={SLIDER_MAX}
                  step="1000"
                  value={sliderRange.min}
                  onChange={handleMinSliderChange}
                  onPointerUp={commitSliderRange}
                  onTouchEnd={commitSliderRange}
                  onKeyUp={commitSliderRange}
                  className="txn-dual-slider__input"
                  aria-label="Minimum spending amount"
                />
                <input
                  type="range"
                  min="0"
                  max={SLIDER_MAX}
                  step="1000"
                  value={sliderRange.max}
                  onChange={handleMaxSliderChange}
                  onPointerUp={commitSliderRange}
                  onTouchEnd={commitSliderRange}
                  onKeyUp={commitSliderRange}
                  className="txn-dual-slider__input"
                  aria-label="Maximum spending amount"
                />
              </div>
            </div>
            <div className="txn-filter-slider-footer">
              <span>₹{sliderRange.min.toLocaleString("en-IN")}</span>
              <span>₹{sliderRange.max.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* (c) Select Date & (d) Apply button at the far right */}
          <div className="txn-filter-col txn-filter-col--date-apply">
            <div className="txn-filter-date-header">
              <span className="txn-filter-col-label">SELECT DATE</span>
            </div>
            <div className="txn-filter-date-action-row">
              <div className="txn-filter-date-inputs">
                <input
                  id="filter-from"
                  className="txn-filter-date-input"
                  type="date"
                  value={filters.from}
                  onChange={(event) => updateFilter("from", event.target.value)}
                  aria-label="From date"
                />
                <span className="txn-filter-date-sep">–</span>
                <input
                  id="filter-to"
                  className="txn-filter-date-input"
                  type="date"
                  value={filters.to}
                  onChange={(event) => updateFilter("to", event.target.value)}
                  aria-label="To date"
                />
              </div>

              <div className="txn-filter-actions-group">
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="txn-filter-reset-btn"
                    onClick={clearFilters}
                    title="Reset all filters"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  className="txn-filter-apply-btn"
                  onClick={handleApplyFilters}
                  title="Apply filters"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="7" y1="12" x2="17" y2="12" />
                    <line x1="10" y1="18" x2="14" y2="18" />
                  </svg>
                  <span>Apply</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic transaction count & records subtitle below the card */}
        <div className="txn-count-bar">
          <h2 className="txn-count-title">{data.total} Transactions</h2>
          <p className="txn-count-subtitle">
            Showing {firstRow}–{lastRow} of {data.total} records
          </p>
        </div>

        {toast && <div className="alert alert--success">{toast}</div>}

        {error && (
          <section className="txn-table-card">
            <div className="txn-state txn-state--error">
              <p className="txn-state__text">{error}</p>
              <button
                type="button"
                className="txn-btn txn-btn--primary"
                onClick={() => setFilters((current) => ({ ...current }))}
              >
                Retry
              </button>
            </div>
          </section>
        )}

        {!error && (
          <section className="txn-table-card">
            {isLoading && data.transactions.length === 0 ? (
              <div className="txn-state">Loading transactions...</div>
            ) : data.transactions.length === 0 ? (
              <div className="txn-state">
                <p className="txn-state__text">
                  {hasActiveFilters
                    ? "No transactions match your search or filters."
                    : "No transactions found."}
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    className="txn-btn txn-btn--primary"
                    onClick={() => setFormTarget({})}
                  >
                    + Add your first transaction
                  </button>
                )}
              </div>
            ) : (
              <>
                <div
                  className={`txn-table-scroll ${
                    isLoading ? "txn-table-scroll--loading" : ""
                  }`}
                >
                  <table className="txn-table">
                    <thead>
                      <tr>
                        <th className="txn-th-date">
                          <button
                            type="button"
                            className="txn-sort-btn"
                            onClick={() => handleSort("date")}
                          >
                            Date
                            <span className="txn-sort-arrow">
                              {filters.sortBy === "date"
                                ? filters.sortOrder === "asc"
                                  ? "↑"
                                  : "↓"
                                : "↕"}
                            </span>
                          </button>
                        </th>
                        <th className="txn-th-vendor">Vendor</th>
                        <th className="txn-th-category">Category</th>
                        <th className="txn-th-dept">Cost Centre / Department</th>
                        <th className="txn-th-amount">Amount</th>
                        <th className="txn-th-actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody>{renderedTransactionRows}</tbody>
                  </table>
                </div>

                {/* PAGINATION: "Showing 1–10 of 50 transactions" and Previous / Page 1 of 5 / Next */}
                <div className="txn-pagination-row">
                  <div className="txn-pagination-info">
                    Showing {firstRow}–{lastRow} of {data.total} transaction
                    {data.total === 1 ? "" : "s"}
                  </div>

                  <div className="txn-pagination-controls">
                    <button
                      type="button"
                      className="txn-page-btn"
                      disabled={data.page <= 1}
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          page: current.page - 1,
                        }))
                      }
                    >
                      Previous
                    </button>
                    <span className="txn-page-indicator">
                      Page {data.page} of {data.totalPages}
                    </span>
                    <button
                      type="button"
                      className="txn-page-btn"
                      disabled={data.page >= data.totalPages}
                      onClick={() =>
                        setFilters((current) => ({
                          ...current,
                          page: current.page + 1,
                        }))
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* Add/edit form - Admin only (Viewer is read-only per the business deck) */}
        {isAdmin && formTarget !== null && (
          <TransactionFormModal
            key={formTarget.id || "add"}
            transaction={formTarget.id ? formTarget : null}
            facets={data.facets}
            onClose={() => setFormTarget(null)}
            onSaved={(message) => {
              setFormTarget(null);
              showToast(message);
              setFilters((current) => ({ ...current })); // refresh the list
            }}
          />
        )}

        {viewTarget && (
          <TransactionViewModal
            key={viewTarget.id}
            transaction={viewTarget}
            onClose={() => setViewTarget(null)}
            onEdit={
              isAdmin
                ? (transaction) => {
                    setViewTarget(null);
                    setFormTarget(transaction);
                  }
                : undefined
            }
          />
        )}

        {/* Part 5: CSV import (Admin only: preview -> confirm -> refresh) */}
        {isAdmin && isImportOpen && (
          <TransactionImportModal
            onClose={() => setIsImportOpen(false)}
            onImported={() => {
              setIsImportOpen(false);
              showToast("CSV import completed.");
              setFilters((current) => ({ ...current })); // refresh the list
            }}
          />
        )}
      </main>
    </div>
  );
}

export default Transactions;
