/** Authentication routes. */

const express = require("express");

const {
  signup,
  login,
  getCurrentUser,
  verifyEmail,
  resendVerification,
  logout,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Protected routes
router.get("/me", protect, getCurrentUser);
router.post("/logout", protect, logout);

module.exports = router;
