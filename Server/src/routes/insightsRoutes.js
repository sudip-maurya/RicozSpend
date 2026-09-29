/** Alerts and insights center routes. */

const express = require("express");

const { getAlertsCenter } = require("../controllers/insightsController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Require authentication
router.use(protect);

router.get("/", getAlertsCenter);

module.exports = router;
