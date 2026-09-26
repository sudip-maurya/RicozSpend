/**
 * Transaction routes (Part 4 CRUD + Part 5 CSV import, MVP RBAC).
 * Mounted at /api/transactions from src/app.js
 *
 * DATA OWNERSHIP = WORKSPACE: reads below are scoped to the caller's
 * organizationId, so Admin and Viewer see the SAME dataset. `user` on a
 * record is audit information (who created it).
 *
 * Authorization stays role-based (per the business deck: Viewer is read-only):
 * Reads: any authenticated (active) user - Admin + Viewer.
 * Create/Update/Delete/CSV import: Admin only - Viewer tokens get HTTP 403
 * via requireRole.
 */
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
// P2-10: registered BEFORE "/:id" so "export" is never mistaken for an id.
router.get("/export", exportTransactions);
router.get("/:id", getTransactionById);

// Part 5 - CSV import (Admin only). Registered BEFORE "/:id" writes so
// "import" is never mistaken for a transaction id.
router.post("/import/preview", requireRole(ROLES.ADMIN), previewImport);
router.post("/import/confirm", requireRole(ROLES.ADMIN), confirmImport);

router.post("/", requireRole(ROLES.ADMIN), createTransaction);
router.put("/:id", requireRole(ROLES.ADMIN), updateTransaction);
router.delete("/:id", requireRole(ROLES.ADMIN), deleteTransaction);

module.exports = router;
