/** Analytics API service (Part 6). */
import api from "../api/client";
import { getErrorMessage } from "../utils/apiError";

/** GET /api/analytics/summary */
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

/** GET /api/analytics/unusual-spending (Part 7) */
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

/** GET /api/analytics/insights (Part 8) Rule-based automatic insights. */
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

/** GET /api/analytics/vendor-comparison (Part 9) */
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

/** GET /api/insights (Part 14 - Alerts & Insights Center) */
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

/** GET /api/analytics/department-spending (Part 10) */
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
