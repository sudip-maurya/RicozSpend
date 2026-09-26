/**
 * Alert Rules API calls (Part 15 - Alerts Center -> Alert Rules editor).
 *
 * Both endpoints are Admin-only: the backend answers HTTP 403 for Viewers, so
 * a Viewer can read every alert but can never change the thresholds.
 * Requests go through src/api/client.js, which attaches the JWT.
 */

import api from "../api/client";
import { getErrorMessage, getFieldErrors } from "../utils/apiError";

const BASE = "/api/alert-rules";

/**
 * GET /api/alert-rules (Admin only)
 * Returns the effective rules, the defaults, the editable field metadata and
 * whether this workspace has saved its own values.
 */
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

/**
 * PUT /api/alert-rules (Admin only)
 * Saves the five percentages. A 400 answers with per-field messages that the
 * form shows next to the offending input.
 */
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
