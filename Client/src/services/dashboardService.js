/**
 * Dashboard API service (Part 3).
 * Thin wrapper around the shared axios client (src/api/client.js) which
 * already attaches the JWT and handles expired sessions.
 */
import api from "../api/client";
import { getErrorMessage } from "../utils/apiError";

/**
 * GET /api/dashboard/summary
 * @param {object} query { range, from, to } - from/to only for range="custom"
 */
export const fetchDashboardSummary = async (query = {}) => {
  try {
    const params = {};

    if (query.range) params.range = query.range;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;

    const { data } = await api.get("/api/dashboard/summary", { params });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the dashboard. Please try again."),
    };
  }
};
