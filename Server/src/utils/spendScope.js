/**
 * Read scope for company spend data (dashboards + analytics + lists).
 *
 * DATA OWNERSHIP = WORKSPACE: every account in the same workspace sees the
 * same transactions and budgets. The scope always includes the caller's
 * organizationId, so one company can never see another company's data -
 * sharing is per-workspace, never global.
 *
 * AUDIT INFORMATION = CREATED BY USER: the `user`/`createdBy` fields on a
 * record say who created it; they are never used to hide shared data.
 *
 * This runs AFTER the `protect` middleware, so the scope always comes from the
 * authenticated account (`req.user`) and can never be influenced by query
 * parameters or the request body. Role checks (requireRole) stay exactly as
 * they were: authentication is per-user, authorization is per-role, only the
 * dataset is shared.
 */

const { ROLES } = require("../models/User");

/** Workspace shared by every account in this deployment. */
const DEFAULT_ORGANIZATION_ID = "ricozspend-default";

/** true for the Admin role (case-insensitive), false for anonymous/Viewer. */
const isAdminUser = (user) =>
  String(user?.role || "").toLowerCase() === String(ROLES.ADMIN).toLowerCase();

/**
 * MongoDB filter fragment for spend reads - identical for Admin and Viewer:
 * every record of the caller's workspace.
 */
const spendScope = (user) => ({
  organizationId: user?.organizationId || DEFAULT_ORGANIZATION_ID,
});

module.exports = {
  DEFAULT_ORGANIZATION_ID,
  isAdminUser,
  spendScope,
};
