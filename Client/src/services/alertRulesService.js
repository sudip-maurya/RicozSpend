/** Alert Rules API calls (Alerts Center -> Alert Rules editor). */

import api from "../api/client";
import { getErrorMessage, getFieldErrors } from "../utils/apiError";

const BASE = "/api/alert-rules";

/** GET /api/alert-rules (Admin only) */
export const fetchAlertRules = async () => {
  try {
    const { data } = await api.get(BASE);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not load the alert rules. Please try again."),
    };
  }
};

/** PUT /api/alert-rules (Admin only) Saves the five percentages. */
export const updateAlertRules = async (rules) => {
  try {
    const { data } = await api.put(BASE, rules);
    return { data };
  } catch (error) {
    return {
      error: getErrorMessage(error, "Could not save the alert rules. Please try again."),
      fieldErrors: getFieldErrors(error),
    };
  }
};
