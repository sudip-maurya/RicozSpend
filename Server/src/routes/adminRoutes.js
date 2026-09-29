/** Admin overview and user management routes. */

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

// Require Admin role
router.use(protect, requireRole(ROLES.ADMIN));

router.get("/overview", getOverview);

// Viewer management
router.get("/users", listViewers);
router.post("/users", createViewer);
router.put("/users/:id", updateViewer);
router.patch("/users/:id/status", setViewerStatus);
router.delete("/users/:id", deleteViewer);

// Admin management
router.get("/admins", listAdmins);
router.post("/admins", createAdminUser);
router.put("/admins/:id", updateAdminUser);
router.patch("/admins/:id/status", setAdminStatus);
router.delete("/admins/:id", deleteAdminUser);

module.exports = router;

