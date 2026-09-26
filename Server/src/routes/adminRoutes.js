/**
 * Admin-only routes (overview + user management for Viewers and Admins).
 * Mounted at /api/admin from src/app.js
 */

const express = require("express");

const {
  getOverview,
  listViewers,
  createViewer,
  updateViewer,
  setViewerStatus,
  deleteViewer,
  listAdmins,
  createAdminUser,
  updateAdminUser,
  setAdminStatus,
  deleteAdminUser,
} = require("../controllers/adminController");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { ROLES } = require("../models/User");

const router = express.Router();

// Every route below requires a valid JWT AND the Admin role.
// Viewers (and anonymous callers) never reach the controllers.
router.use(protect, requireRole(ROLES.ADMIN));

router.get("/overview", getOverview);

// Viewer user management (Admin only).
router.get("/users", listViewers);
router.post("/users", createViewer);
router.put("/users/:id", updateViewer);
router.patch("/users/:id/status", setViewerStatus);
router.delete("/users/:id", deleteViewer);

// Admin management (Admin only).
router.get("/admins", listAdmins);
router.post("/admins", createAdminUser);
router.put("/admins/:id", updateAdminUser);
router.patch("/admins/:id/status", setAdminStatus);
router.delete("/admins/:id", deleteAdminUser);

module.exports = router;

