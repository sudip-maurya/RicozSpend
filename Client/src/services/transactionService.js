/**
 * Transaction API service (Part 4).
 * Thin wrappers around the shared axios client (src/api/client.js) which
 * already attaches the JWT and handles expired sessions.
 */
import api from "../api/client";
import { getErrorMessage, getFieldErrors } from "../utils/apiError";

/**
 * GET /api/transactions
 * @param {object} query { search, category, department, vendor, minAmount, maxAmount,
 *                         from, to, sortBy, sortOrder, page, limit }
 */
export const fetchTransactions = async (query = {}) => {
  try {
    const { data } = await api.get("/api/transactions", { params: query });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Unable to load transactions. Please try again."),
    };
  }
};

/**
 * POST /api/transactions
 * @param {object} payload amount, vendor, category, department, date, description
 */
export const createTransaction = async (payload) => {
  try {
    const { data } = await api.post("/api/transactions", payload);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not save the transaction. Please try again."),
      fieldErrors: getFieldErrors(error),
    };
  }
};

/** PUT /api/transactions/:id - updates the existing record. */
export const updateTransaction = async (id, payload) => {
  try {
    const { data } = await api.put(`/api/transactions/${id}`, payload);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not update the transaction. Please try again."),
      fieldErrors: getFieldErrors(error),
    };
  }
};

/** DELETE /api/transactions/:id */
export const deleteTransaction = async (id) => {
  try {
    const { data } = await api.delete(`/api/transactions/${id}`);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not delete the transaction. Please try again."),
    };
  }
};

/**
 * POST /api/transactions/import/preview (Part 5)
 * Sends the raw CSV text; the server validates it and returns the preview.
 * Nothing is saved at this point.
 */
export const previewCsvImport = async (csv) => {
  try {
    const { data } = await api.post("/api/transactions/import/preview", { csv });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not read the CSV file. Please check it and try again."),
    };
  }
};

/**
 * POST /api/transactions/import/confirm (Part 5)
 * Imports the valid, non-duplicate rows and returns the server result summary.
 */
export const confirmCsvImport = async (csv) => {
  try {
    const { data } = await api.post("/api/transactions/import/confirm", { csv });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "The import failed. Please try again."),
    };
  }
};

/**
 * GET /api/transactions/export (P2-10)
 * Downloads the workspace's transactions as CSV using the same filters as the
 * list endpoint. Triggers a browser download of transactions.csv.
 */
export const exportTransactionsCsv = async (query = {}) => {
  try {
    const params = {};

    if (query.search) params.search = query.search;
    if (query.category) params.category = query.category;
    if (query.department) params.department = query.department;
    if (query.vendor) params.vendor = query.vendor;
    if (query.minAmount !== "" && query.minAmount !== undefined)
      params.minAmount = query.minAmount;
    if (query.maxAmount !== "" && query.maxAmount !== undefined)
      params.maxAmount = query.maxAmount;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.sortBy) params.sortBy = query.sortBy;
    if (query.sortOrder) params.sortOrder = query.sortOrder;

    const response = await api.get("/api/transactions/export", {
      params,
      responseType: "blob",
    });

    const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "transactions.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return {};
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not export the transactions. Please try again."),
    };
  }
};
