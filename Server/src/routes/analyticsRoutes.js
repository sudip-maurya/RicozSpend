/**
 * Analytics routes (Part 6 - spend analysis & charts).
 * Mounted at /api/analytics from src/app.js
 */

const express = require("express");

const {
  getAnalyticsSummary,
  getUnusualSpending,
  getSpendInsights,
  getVendorComparison,
  getDepartmentSpending,
} = require("../controllers/analyticsController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Analytics require a valid JWT (same middleware as the dashboard). Data is
// always scoped to req.user inside the controller - never from query params.
router.use(protect);

router.get("/summary", getAnalyticsSummary);

// Part 7 - basic unusual spending alerts (rule-based, computed on demand).
router.get("/unusual-spending", getUnusualSpending);

// Part 8 - automatic spend insights (deterministic rules over real data).
router.get("/insights", getSpendInsights);

// Part 9 - basic vendor comparison (factual spend / txns / share per vendor).
router.get("/vendor-comparison", getVendorComparison);

// Part 10/13 - department spending patterns (factual spend / txns / share per
// department; Part 13 adds highest-spending department + average per
// department to the same response). Read-only for Admin and Viewer alike.
router.get("/department-spending", getDepartmentSpending);

module.exports = router;
