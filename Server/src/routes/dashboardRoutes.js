/**
 * Dashboard routes (Part 3 - spend overview).
 * Mounted at /api/dashboard from src/app.js
 */

const express = require("express");

const { getSummary } = require("../controllers/dashboardController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Every dashboard route requires a valid JWT. Both Admin and Viewer roles are
// allowed here (no requireRole): every authenticated user reads the shared
// workspace data (see src/utils/spendScope.js).
router.use(protect);

router.get("/summary", getSummary);

module.exports = router;