/**
 * Analytics API service (Part 6).
 * Thin wrappers around the shared axios client (src/api/client.js) which
 * already attaches the JWT and handles expired sessions.
 */
import api from "../api/client";
import { getErrorMessage } from "../utils/apiError";

/**
 * GET /api/analytics/summary
 * @param {object} query { from, to, category, department, vendor }
 */
export const fetchAnalyticsSummary = async (query = {}) => {
  try {
    const params = {};

    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.category) params.category = query.category;
    if (query.department) params.department = query.department;
    if (query.vendor) params.vendor = query.vendor;

    const { data } = await api.get("/api/analytics/summary", { params });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the spend analysis. Please try again."),
    };
  }
};

/**
 * GET /api/analytics/unusual-spending (Part 7)
 * Rule-based alerts: transactions above (average amount x the admin-configured
 * unusual-spending multiplier, default 1.5x). Follows the dashboard's own
 * range/from/to filter (P2-8).
 * @param {object} query { range, from, to }
 */
export const fetchUnusualSpending = async (query = {}) => {
  try {
    const params = {};

    if (query.range) params.range = query.range;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;

    const { data } = await api.get("/api/analytics/unusual-spending", { params });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the unusual spending alerts. Please try again."),
    };
  }
};

/**
 * GET /api/analytics/insights (Part 8)
 * Rule-based automatic insights. Accepts the dashboard's own filter
 * (range / from / to) so insights follow the single existing filter system.
 * @param {object} query { range, from, to, category, department, vendor }
 */
export const fetchSpendInsights = async (query = {}) => {
  try {
    const params = {};

    if (query.range) params.range = query.range;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.category) params.category = query.category;
    if (query.department) params.department = query.department;
    if (query.vendor) params.vendor = query.vendor;

    const { data } = await api.get("/api/analytics/insights", { params });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the spend insights. Please try again."),
    };
  }
};

/**
 * GET /api/analytics/vendor-comparison (Part 9)
 * Factual vendor spend comparison (total spend, transactions, share of total).
 * Uses the same filter shape as the spend analysis page.
 * @param {object} query { from, to, category, department, vendor }
 */
export const fetchVendorComparison = async (query = {}) => {
  try {
    const params = {};

    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.category) params.category = query.category;
    if (query.department) params.department = query.department;
    if (query.vendor) params.vendor = query.vendor;

    const { data } = await api.get("/api/analytics/vendor-comparison", { params });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the vendor comparison. Please try again."),
    };
  }
};

/**
 * GET /api/insights (Part 14 - Alerts & Insights Center)
 * One deterministic payload: summary counts + 4 sections (budget / unusual /
 * spending / activity) of rule-based alerts derived from existing data.
 */
export const fetchAlertsCenter = async () => {
  try {
    const { data } = await api.get("/api/insights");
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the alerts & insights center. Please try again."),
    };
  }
};

/**
 * GET /api/analytics/department-spending (Part 10)
 * Factual department spend patterns (total spend, transactions, share of total).
 * Uses the same filter shape as the spend analysis page.
 * @param {object} query { from, to, category, department, vendor }
 */
export const fetchDepartmentSpending = async (query = {}) => {
  try {
    const params = {};

    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.category) params.category = query.category;
    if (query.department) params.department = query.department;
    if (query.vendor) params.vendor = query.vendor;

    const { data } = await api.get("/api/analytics/department-spending", { params });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the department spending. Please try again."),
    };
  }
};
