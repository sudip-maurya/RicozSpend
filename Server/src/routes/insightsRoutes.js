/**
 * Alerts & Insights Center routes (Part 14).
 * Mounted at /api/insights from src/app.js
 */

const express = require("express");

const { getAlertsCenter } = require("../controllers/insightsController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Read-only for Admin and Viewer alike (same rule as analytics): a valid JWT
// is required, data is always scoped to req.user via spendScope in the
// controller - never from query params.
router.use(protect);

// Part 14 - deterministic alerts + insights gathered from existing data.
router.get("/", getAlertsCenter);

module.exports = router;
