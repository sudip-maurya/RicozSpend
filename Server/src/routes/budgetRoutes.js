/** Budget management and comparison routes. */

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

// Budget vs actual comparison
router.get("/comparison", getBudgetVsActual);

router.post("/", requireRole(ROLES.ADMIN), createBudget);
router.put("/:id", requireRole(ROLES.ADMIN), updateBudget);
router.delete("/:id", requireRole(ROLES.ADMIN), deleteBudget);

module.exports = router;
