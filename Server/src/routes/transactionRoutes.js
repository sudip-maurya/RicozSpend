/** Transaction CRUD, export, and import routes. */
const express = require("express");

const {
  createTransaction,
  getTransactions,
  exportTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  previewImport,
  confirmImport,
} = require("../controllers/transactionController");
const { protect, requireRole } = require("../middleware/authMiddleware");
const { ROLES } = require("../models/User");

const router = express.Router();

router.use(protect);

router.get("/", getTransactions);
// Export CSV
router.get("/export", exportTransactions);
router.get("/:id", getTransactionById);

// CSV import (Admin only)
router.post("/import/preview", requireRole(ROLES.ADMIN), previewImport);
router.post("/import/confirm", requireRole(ROLES.ADMIN), confirmImport);

router.post("/", requireRole(ROLES.ADMIN), createTransaction);
router.put("/:id", requireRole(ROLES.ADMIN), updateTransaction);
router.delete("/:id", requireRole(ROLES.ADMIN), deleteTransaction);

module.exports = router;
