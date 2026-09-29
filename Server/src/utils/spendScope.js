/** Workspace read scope helpers for spend data. */

const { ROLES } = require("../models/User");

/** Default workspace identifier. */
const DEFAULT_ORGANIZATION_ID = "ricozspend-default";

/** Check if user has Admin role. */
const isAdminUser = (user) =>
  String(user?.role || "").toLowerCase() === String(ROLES.ADMIN).toLowerCase();

/** MongoDB scope filter for workspace data. */
const spendScope = (user) => ({
  organizationId: user?.organizationId || DEFAULT_ORGANIZATION_ID,
});

module.exports = {
  DEFAULT_ORGANIZATION_ID,
  isAdminUser,
  spendScope,
};
