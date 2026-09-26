/**
 * Budget routes (Part 9 - Budget vs Actual).
 * Mounted at /api/budgets from src/app.js
 *
 * DATA OWNERSHIP = WORKSPACE: reads AND budget writes are scoped to the
 * caller's organizationId, so Admin and Viewer work on the SAME budget
 * dataset. `user`/`createdBy` stay audit information (who created it).
 *
 * Reads (list + Budget vs Actual): any authenticated (active) user.
 * Writes (add / edit / delete a budget): Admin only - Viewers get HTTP 403
 * through the same requireRole guard used by the transaction routes.
 */

const express = require("express");

const {
  createBudget,
  getBudgets,
  getBudgetVsActual,
  updateBudget,
  deleteBudget,
} = require("../controllers/budgetController");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { ROLES } = require("../models/User");

const router = express.Router();

router.use(protect);

router.get("/", getBudgets);

// Budget vs Actual. Registered before the "/:id" writes so "comparison" can
// never be mistaken for a budget id.
router.get("/comparison", getBudgetVsActual);

router.post("/", requireRole(ROLES.ADMIN), createBudget);
router.put("/:id", requireRole(ROLES.ADMIN), updateBudget);
router.delete("/:id", requireRole(ROLES.ADMIN), deleteBudget);

module.exports = router;
