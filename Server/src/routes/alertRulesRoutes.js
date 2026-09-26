/**
 * Alert Rules routes (Part 15 - Admin-configurable thresholds).
 * Mounted at /api/alert-rules from src/app.js
 *
 * Admin only: Viewers can read every alert (GET /api/insights) but can never
 * read or change the rules that generate them. The effective thresholds are
 * published read-only inside the alerts payload, so the read-only experience
 * stays complete without exposing a write surface.
 */

const express = require("express");

const { getAlertRules, updateAlertRules } = require("../controllers/alertRulesController");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { ROLES } = require("../models/User");

const router = express.Router();

// Every route below requires a valid JWT AND the Admin role.
router.use(protect, requireRole(ROLES.ADMIN));

// Part 15 - read the effective rules / save new percentages.
router.get("/", getAlertRules);
router.put("/", updateAlertRules);

module.exports = router;
