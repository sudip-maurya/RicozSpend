/**
 * Admin User & Admin-management API calls.
 * All endpoints are Admin-only: the backend answers HTTP 403 for Viewers.
 * Requests go through src/api/client.js, which attaches the JWT.
 */

import api from "../api/client";

const BASE = "/api/admin";

/** Admin-only endpoint (Viewers get HTTP 403). */
export const fetchAdminOverview = () => api.get(`${BASE}/overview`);

/** GET /api/admin/users - list Viewers and their account status. */
export const fetchViewers = () => api.get(`${BASE}/users`);

/** POST /api/admin/users - create a Viewer. */
export const createViewer = (payload) => api.post(`${BASE}/users`, payload);

/** PUT /api/admin/users/:id - edit Viewer details. */
export const updateViewer = (id, payload) => api.put(`${BASE}/users/${id}`, payload);

/** PATCH /api/admin/users/:id/status - activate/deactivate a Viewer. */
export const setViewerStatus = (id, isActive) =>
  api.patch(`${BASE}/users/${id}/status`, { isActive });

/** DELETE /api/admin/users/:id - delete a Viewer. */
export const deleteViewer = (id) => api.delete(`${BASE}/users/${id}`);

/* ------------------------------------------------------------- Admin management */

/** GET /api/admin/admins - list Admins in workspace. */
export const fetchAdmins = () => api.get(`${BASE}/admins`);

/** POST /api/admin/admins - create an Admin. */
export const createAdmin = (payload) => api.post(`${BASE}/admins`, payload);

/** PUT /api/admin/admins/:id - edit Admin details. */
export const updateAdmin = (id, payload) => api.put(`${BASE}/admins/${id}`, payload);

/** PATCH /api/admin/admins/:id/status - activate/deactivate an Admin. */
export const setAdminStatus = (id, isActive) =>
  api.patch(`${BASE}/admins/${id}/status`, { isActive });

/** DELETE /api/admin/admins/:id - delete an Admin. */
export const deleteAdmin = (id) => api.delete(`${BASE}/admins/${id}`);

