/** Roles supported by the backend (Part 2). Keep in sync with Server/src/models/User.js */
export const ROLES = {
  ADMIN: "Admin",
  VIEWER: "Viewer",
};

export const isAdminRole = (role) => String(role || "").toLowerCase() === ROLES.ADMIN.toLowerCase();
