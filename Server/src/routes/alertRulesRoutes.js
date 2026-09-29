/** Alert rules configuration routes. */

const express = require("express");

const { getAlertRules, updateAlertRules } = require("../controllers/alertRulesController");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { ROLES } = require("../models/User");

const router = express.Router();

// Require Admin role
router.use(protect, requireRole(ROLES.ADMIN));

router.get("/", getAlertRules);
router.put("/", updateAlertRules);

module.exports = router;
