import { useCallback, useEffect, useRef, useState } from "react";

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
    setFilters((current) => ({
      ...DEFAULT_FILTERS,
      limit: current.limit, // keep the chosen page size
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

  const sortIndicator = (field) =>
    filters.sortBy === field ? (
      <span className="txn-sort__arrow">
        {filters.sortOrder === "asc" ? "\u2191" : "\u2193"}
      </span>
    ) : null;

  const firstRow = data.total === 0 ? 0 : (data.page - 1) * data.limit + 1;
  const lastRow = Math.min(data.page * data.limit, data.total);

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="txn-toolbar">
          <div>
            <h1 className="page-title">Spend / Transactions</h1>
            <p className="page-subtitle">Manage your spending records</p>
          </div>

          <div className="txn-toolbar__actions">
            <input
              className="txn-search"
              type="search"
              placeholder="Search vendor, category, department, description, ID..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              aria-label="Search transactions"
            />
            {isAdmin && (
              <button type="button" className="btn" onClick={() => setFormTarget({})}>
                + Add Transaction
              </button>
            )}
            {/* Part 5: CSV import, next to Add Transaction (Admin only) */}
            {isAdmin && (
              <button type="button" className="btn btn--ghost" onClick={() => setIsImportOpen(true)}>
                Import CSV
              </button>
            )}
            {/* P2-10: CSV export with the active filters (all roles) */}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>
        </div>

        {/* Filters: category, department, vendor, amount range, date range - all work together */}
        <section className="card">
          <div className="txn-filters">
            <div className="form-field">
              <label className="form-field__label" htmlFor="filter-category">
                Category
              </label>
              <select
                id="filter-category"
                className="txn-filter__select"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value)}
              >
                <option value="">All categories</option>
                {data.facets.categories.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="filter-department">
                Cost Centre / Department
              </label>
              <select
                id="filter-department"
                className="txn-filter__select"
                value={filters.department}
                onChange={(event) => updateFilter("department", event.target.value)}
              >
                <option value="">All departments</option>
                {data.facets.departments.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="filter-vendor">
                Vendor
              </label>
              <select
                id="filter-vendor"
                className="txn-filter__select"
                value={filters.vendor}
                onChange={(event) => updateFilter("vendor", event.target.value)}
              >
                <option value="">All vendors</option>
                {data.facets.vendors.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="filter-min-amount">
                Min amount
              </label>
              <input
                id="filter-min-amount"
                className="txn-filter__date"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={filters.minAmount}
                onChange={(event) => updateFilter("minAmount", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="filter-max-amount">
                Max amount
              </label>
              <input
                id="filter-max-amount"
                className="txn-filter__date"
                type="number"
                min="0"
                step="0.01"
                placeholder="No max"
                value={filters.maxAmount}
                onChange={(event) => updateFilter("maxAmount", event.target.value)}
              />
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="filter-from">
                From
              </label>
              <input
                id="filter-from"
                className="txn-filter__date"
                type="date"
                value={filters.from}
                onChange={(event) => updateFilter("from", event.target.value)}
              />
            </div>

            <span className="txn-filter__dash">-</span>

            <div className="form-field">
              <label className="form-field__label" htmlFor="filter-to">
                To
              </label>
              <input
                id="filter-to"
                className="txn-filter__date"
                type="date"
                value={filters.to}
                onChange={(event) => updateFilter("to", event.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <button type="button" className="btn btn--ghost" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </section>

        {toast && <div className="alert alert--success">{toast}</div>}

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

        {!error && (
          <section className="card">
            {isLoading ? (
              <div className="txn-state">Loading transactions...</div>
            ) : data.transactions.length === 0 ? (
              <div className="txn-state">
                <p className="card__text">
                  {hasActiveFilters
                    ? "No transactions match your search or filters."
                    : "No transactions found."}
                </p>
                {isAdmin && (
                  <button type="button" className="btn" onClick={() => setFormTarget({})}>
                    + Add your first transaction
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="txn-table-wrap">
                  <table className="txn-table">
                    <thead>
                      <tr>
                        <th>
                          <button
                            type="button"
                            className="txn-sort"
                            onClick={() => handleSort("date")}
                          >
                            Date {sortIndicator("date")}
                          </button>
                        </th>
                        <th>
                          <button
                            type="button"
                            className="txn-sort"
                            onClick={() => handleSort("vendor")}
                          >
                            Vendor {sortIndicator("vendor")}
                          </button>
                        </th>
                        <th>Category</th>
                        <th>Cost Centre / Department</th>
                        <th className="txn-table__amount">
                          <button
                            type="button"
                            className="txn-sort"
                            onClick={() => handleSort("amount")}
                          >
                            Amount {sortIndicator("amount")}
                          </button>
                        </th>
                        {isAdmin && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.transactions.map((transaction) => (
                        <tr key={transaction.id}>
                          <td>{formatDate(transaction.date)}</td>
                          <td>
                            <button
                              type="button"
                              className="txn-vendor"
                              onClick={() => setViewTarget(transaction)}
                            >
                              {transaction.vendor}
                            </button>
                          </td>
                          <td>{transaction.category}</td>
                          <td>{transaction.department}</td>
                          <td className="txn-table__amount">
                            {formatMoney(transaction.amount)}
                          </td>
                          {isAdmin ? (
                            <td>
                              {deleteTarget?.id === transaction.id ? (
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
                                    onClick={() => setViewTarget(transaction)}
                                  >
                                    View
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--ghost"
                                    onClick={() => setFormTarget(transaction)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--danger"
                                    onClick={() => setDeleteTarget(transaction)}
                                  >
                                    Delete
                                  </button>
                                </span>
                              )}
                            </td>
                          ) : (
                            <td>
                              <span className="txn-table__actions">
                                <button
                                  type="button"
                                  className="btn btn--ghost"
                                  onClick={() => setViewTarget(transaction)}
                                >
                                  View
                                </button>
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Simple pagination: "Showing 1-10 of 126 transactions" */}
                <div className="txn-pagination">
                  <span>
                    Showing {firstRow}-{lastRow} of {data.total} transaction
                    {data.total === 1 ? "" : "s"}
                  </span>

                  <div className="txn-pagination__controls">
                    <select
                      id="page-size"
                      className="txn-filter__select"
                      value={data.limit}
                      onChange={(event) =>
                        updateFilter("limit", Number(event.target.value))
                      }
                      aria-label="Transactions per page"
                    >
                      {PAGE_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size} / page
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={data.page <= 1}
                      onClick={() =>
                        setFilters((current) => ({ ...current, page: current.page - 1 }))
                      }
                    >
                      Previous
                    </button>
                    <span className="txn-pagination__page">
                      Page {data.page} of {data.totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={data.page >= data.totalPages}
                      onClick={() =>
                        setFilters((current) => ({ ...current, page: current.page + 1 }))
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
