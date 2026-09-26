/**
 * Authentication routes (Part 2).
 * Mounted at /api/auth from src/app.js
 */

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

// Public
router.post("/signup", signup);
router.post("/login", login);

// Part 2 - email verification (public: the token is the credential)
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerification);

// Protected - requires a valid JWT
router.get("/me", protect, getCurrentUser);
router.post("/logout", protect, logout);

module.exports = router;
