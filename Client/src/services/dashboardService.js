/** Dashboard API service (Part 3). */
import api from "../api/client";
import { getErrorMessage } from "../utils/apiError";

/** GET /api/dashboard/summary */
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
