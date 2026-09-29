/** Analytics and reporting routes. */

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

// Require authentication
router.use(protect);

router.get("/summary", getAnalyticsSummary);
router.get("/unusual-spending", getUnusualSpending);
router.get("/insights", getSpendInsights);
router.get("/vendor-comparison", getVendorComparison);
router.get("/department-spending", getDepartmentSpending);

module.exports = router;
