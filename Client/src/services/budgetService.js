/** Budget API service (Part 9 - Budget vs Actual). */
import api from "../api/client";
import { getErrorMessage, getFieldErrors } from "../utils/apiError";

/** Same filter shape as the other analytics pages (skips empty values). */
const buildParams = (query = {}) => {
  const params = {};

  if (query.period) params.period = query.period;
  if (query.department) params.department = query.department;
  if (query.category) params.category = query.category;

  return params;
};

/** GET /api/budgets/comparison Budget vs Actual for the authenticated user */
export const fetchBudgetComparison = async (query = {}) => {
  try {
    const { data } = await api.get("/api/budgets/comparison", { params: buildParams(query) });
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the budget comparison. Please try again."),
    };
  }
};

/** POST /api/budgets (Admin only - the backend answers 403 for Viewers) */
export const createBudget = async (payload) => {
  try {
    const { data } = await api.post("/api/budgets", payload);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not save the budget. Please try again."),
      fieldErrors: getFieldErrors(error),
    };
  }
};

/** PUT /api/budgets/:id - updates the existing budget (Admin only). */
export const updateBudget = async (id, payload) => {
  try {
    const { data } = await api.put(`/api/budgets/${id}`, payload);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not update the budget. Please try again."),
      fieldErrors: getFieldErrors(error),
    };
  }
};

/** DELETE /api/budgets/:id (Admin only). */
export const deleteBudget = async (id) => {
  try {
    const { data } = await api.delete(`/api/budgets/${id}`);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not delete the budget. Please try again."),
    };
  }
};
