// Transaction controllers
const mongoose = require("mongoose");
const { isValidObjectId } = mongoose;

const Transaction = require("../models/Transaction");
const { spendScope } = require("../utils/spendScope");
const {
  MAX_CSV_LENGTH,
  MAX_ROWS,
  buildDuplicateKey,
  mapHeaders,
  parseCsv,
  validateRow,
} = require("../utils/csvParser");

// Format date as DD/MM/YYYY
const formatDateDmy = (date) => {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
};

// Format row for preview table
const rowDisplayFields = (source, columns) => {
  if (columns) {
    const get = (name) => cleanText(source[columns[name]]);
    return {
      date: get("date"),
      vendor: get("vendor"),
      category: get("category"),
      department: get("department"),
      amount: get("amount"),
    };
  }
  return {
    date: formatDateDmy(source.date),
    vendor: source.vendor,
    category: source.category,
    department: source.department,
    amount: source.amount,
  };
};

// Parse, validate CSV and flag duplicates
const analyzeCsv = async (csv, organizationId) => {
  if (typeof csv !== "string" || csv.trim() === "") {
    return { error: "The CSV file is empty." };
  }

  if (csv.length > MAX_CSV_LENGTH) {
    return { error: "The CSV file is too large. Please upload a file under 2 MB." };
  }

  const rows = parseCsv(csv);
  const headerRow = rows.find((cells) => cells.some((cell) => cleanText(cell) !== ""));

  if (!headerRow) {
    return { error: "The CSV file is empty." };
  }

  const { columns, missing, unknown } = mapHeaders(headerRow);
  if (missing.length > 0) {
    return {
      error: `Missing required column(s): ${missing.join(", ")}. Expected header: Amount, Vendor, Category, Department, Date, Description (optional).`,
    };
  }

  const headerIndex = rows.indexOf(headerRow);
  const summary = { totalRows: 0, valid: 0, invalid: 0, duplicates: 0 };
  const parsedRows = [];
  const keysInFile = new Map(); // duplicate key -> first CSV row number

  // Pass 1: validate every data row (blank lines are skipped but numbered).
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const isBlank = cells.every((cell) => cleanText(cell) === "");
    if (isBlank) continue;

    summary.totalRows += 1;
    if (summary.totalRows > MAX_ROWS) {
      return { error: `Too many rows. A single import is limited to ${MAX_ROWS} rows.` };
    }

    const { errors, data } = validateRow(cells, columns);

    if (errors.length > 0) {
      summary.invalid += 1;
      parsedRows.push({
        row: i + 1,
        ...rowDisplayFields(cells, columns),
        status: "Invalid",
        reason: errors.join("; "),
        data: null,
      });
      continue;
    }

    const key = buildDuplicateKey(data);
    const firstSeenAtRow = keysInFile.get(key);

    if (firstSeenAtRow !== undefined) {
      summary.duplicates += 1;
      parsedRows.push({
        row: i + 1,
        ...rowDisplayFields(data),
        status: "Duplicate",
        reason: `Duplicate of row ${firstSeenAtRow} in this file`,
        data: null,
      });
      continue;
    }

    keysInFile.set(key, i + 1);
    summary.valid += 1;
    parsedRows.push({ row: i + 1, ...rowDisplayFields(data), status: "Valid", reason: "", data });
  }

  // Pass 2: check duplicates against existing transactions
  const validRows = parsedRows.filter((entry) => entry.status === "Valid");

  if (validRows.length > 0) {
    const dates = validRows.map((entry) => entry.data.date.getTime());
    const existing = await Transaction.find({
      organizationId,
      date: { $gte: new Date(Math.min(...dates)), $lte: new Date(Math.max(...dates)) },
    });

    const existingKeys = new Set(existing.map((doc) => buildDuplicateKey(doc)));

    for (const entry of validRows) {
      if (existingKeys.has(buildDuplicateKey(entry.data))) {
        entry.status = "Duplicate";
        entry.reason = "Already exists in your transactions";
        entry.data = null;
        summary.valid -= 1;
        summary.duplicates += 1;
      }
    }
  }

  return { summary, rows: parsedRows, unknownColumns: unknown };
};

const DEFAULT_PAGE_LIMIT = 10;
const MAX_PAGE_LIMIT = 100;
const SORT_FIELDS = ["date", "amount", "vendor"];

const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";
const NOT_FOUND_MESSAGE = "Transaction not found.";
const INVALID_ID_MESSAGE = "Invalid transaction id.";

// Validation
const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

// Validate and clean transaction payload
const validateTransaction = (body) => {
  const errors = {};

  const amount = Number(body?.amount);
  if (body?.amount === undefined || body?.amount === null || body?.amount === "") {
    errors.amount = "Amount is required.";
  } else if (!Number.isFinite(amount)) {
    errors.amount = "Amount must be a valid number.";
  } else if (amount <= 0) {
    errors.amount = "Amount must be greater than 0.";
  }

  const vendor = cleanText(body?.vendor);
  if (!vendor) errors.vendor = "Vendor is required.";

  const category = cleanText(body?.category);
  if (!category) errors.category = "Category is required.";

  const department = cleanText(body?.department);
  if (!department) errors.department = "Cost centre / department is required.";

  let date;
  if (!body?.date) {
    errors.date = "Date is required.";
  } else {
    const dateText = cleanText(body.date);
    date = /^\d{4}-\d{2}-\d{2}$/.test(dateText)
      ? new Date(`${dateText}T00:00:00.000Z`)
      : new Date(body.date);
    if (Number.isNaN(date.getTime())) {
      errors.date = "Date must be a valid date.";
    }
  }

  const description = cleanText(body?.description);

  if (Object.keys(errors).length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors,
    data: {
      amount: Math.round(amount * 100) / 100,
      vendor,
      category,
      department,
      date,
      description,
    },
  };
};

// Map Mongoose validation errors
const mongooseValidationErrors = (error) => {
  const errors = {};
  Object.values(error.errors || {}).forEach((fieldError) => {
    if (fieldError && fieldError.path) {
      errors[fieldError.path] = fieldError.message;
    }
  });
  return errors;
};

// POST /api/transactions
const createTransaction = async (req, res) => {
  const { isValid, errors, data } = validateTransaction(req.body || {});

  if (!isValid) {
    return res.status(400).json({
      message: "Please check the highlighted fields and try again.",
      errors,
    });
  }

  try {
    const scope = spendScope(req.user);
    const transaction = await Transaction.create({
      ...data,
      organizationId: scope.organizationId,
      user: req.user._id,
    });

    return res.status(201).json({
      message: "Transaction created successfully.",
      transaction,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Please check the highlighted fields and try again.",
        errors: mongooseValidationErrors(error),
      });
    }

    console.error("[transactions] Create failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

// Escape user input for RegExp
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Parse optional amount bound
const parseAmountBound = (raw, name) => {
  if (raw === undefined || raw === null || String(raw).trim() === "") return {};
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { error: `Invalid ${name}. Use a number of 0 or more.` };
  }
  return { value };
};

const buildListFilter = (query) => {
  const filter = {};

  // Search fields or ObjectId
  const search = cleanText(query.search);
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { vendor: pattern },
      { category: pattern },
      { department: pattern },
      { description: pattern },
    ];
    if (mongoose.isValidObjectId(search)) {
      filter.$or.push({ _id: new mongoose.Types.ObjectId(search) });
    }
  }

  const category = cleanText(query.category);
  if (category) {
    filter.category = new RegExp(`^${escapeRegex(category)}$`, "i");
  }

  const department = cleanText(query.department);
  if (department) {
    filter.department = new RegExp(`^${escapeRegex(department)}$`, "i");
  }

  // Exact vendor filter
  const vendor = cleanText(query.vendor);
  if (vendor) {
    filter.vendor = new RegExp(`^${escapeRegex(vendor)}$`, "i");
  }

  // Amount range
  const min = parseAmountBound(query.minAmount, "minAmount");
  if (min.error) return { error: min.error };
  const max = parseAmountBound(query.maxAmount, "maxAmount");
  if (max.error) return { error: max.error };
  if (min.value !== undefined && max.value !== undefined && min.value > max.value) {
    return { error: "Min amount cannot be greater than max amount." };
  }
  if (min.value !== undefined || max.value !== undefined) {
    filter.amount = {};
    if (min.value !== undefined) filter.amount.$gte = min.value;
    if (max.value !== undefined) filter.amount.$lte = max.value;
  }

  // Inclusive date range
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
  const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : null;

  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return { error: "Invalid date range. Use YYYY-MM-DD for from/to." };
  }

  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  return { filter };
};

// GET /api/transactions
const getTransactions = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const { filter, error } = buildListFilter(req.query);
    if (error) {
      return res.status(400).json({ message: error });
    }
    Object.assign(filter, scope);

    const sortBy = SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : "date";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT, 1),
      MAX_PAGE_LIMIT
    );
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [transactions, total, categories, departments, vendors] = await Promise.all([
      Transaction.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-user"),
      Transaction.countDocuments(filter),
      // Facet options for workspace
      Transaction.distinct("category", scope),
      Transaction.distinct("department", scope),
      Transaction.distinct("vendor", scope),
    ]);

    return res.json({
      transactions,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      facets: {
        categories: categories.filter(Boolean).sort(),
        departments: departments.filter(Boolean).sort(),
        vendors: vendors.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    console.error("[transactions] List failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

// Escape CSV value
const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// GET /api/transactions/export - download workspace transactions as CSV
const exportTransactions = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const { filter, error } = buildListFilter(req.query);
    if (error) {
      return res.status(400).json({ message: error });
    }
    Object.assign(filter, scope);

    const sortBy = SORT_FIELDS.includes(req.query.sortBy) ? req.query.sortBy : "date";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const transactions = await Transaction.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(50000)
      .select("-user")
      .lean();

    const lines = ["Date,Vendor,Category,Department,Amount,Description"];
    for (const tx of transactions) {
      lines.push(
        [
          tx.date ? new Date(tx.date).toISOString().slice(0, 10) : "",
          tx.vendor,
          tx.category,
          tx.department,
          tx.amount,
          tx.description,
        ]
          .map(csvCell)
          .join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="transactions.csv"');
    // UTF-8 BOM
    return res.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (error) {
    console.error("[transactions] Export failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

// Find transaction by id in workspace
const findWorkspaceTransaction = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    res.status(400).json({ message: INVALID_ID_MESSAGE });
    return null;
  }

  const transaction = await Transaction.findOne({ _id: id, ...spendScope(req.user) });

  if (!transaction) {
    res.status(404).json({ message: NOT_FOUND_MESSAGE });
    return null;
  }

  return transaction;
};

// GET /api/transactions/:id
const getTransactionById = async (req, res) => {
  try {
    const transaction = await findWorkspaceTransaction(req, res);
    if (!transaction) return;

    return res.json({ transaction });
  } catch (error) {
    console.error("[transactions] Get by id failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

// PUT /api/transactions/:id
const updateTransaction = async (req, res) => {
  const { isValid, errors, data } = validateTransaction(req.body || {});

  if (!isValid) {
    return res.status(400).json({
      message: "Please check the highlighted fields and try again.",
      errors,
    });
  }

  try {
    const existing = await findWorkspaceTransaction(req, res);
    if (!existing) return;

    const transaction = await Transaction.findByIdAndUpdate(existing._id, data, {
      new: true,
      runValidators: true,
      context: "query",
    });

    return res.json({
      message: "Transaction updated successfully.",
      transaction,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Please check the highlighted fields and try again.",
        errors: mongooseValidationErrors(error),
      });
    }

    console.error("[transactions] Update failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

// DELETE /api/transactions/:id
const deleteTransaction = async (req, res) => {
  try {
    const existing = await findWorkspaceTransaction(req, res);
    if (!existing) return;

    await existing.deleteOne();

    return res.json({ message: "Transaction deleted successfully." });
  } catch (error) {
    console.error("[transactions] Delete failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

// POST /api/transactions/import/preview
const previewImport = async (req, res) => {
  try {
    const result = await analyzeCsv(req.body?.csv, spendScope(req.user).organizationId);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    return res.json(result);
  } catch (error) {
    console.error("[transactions] CSV preview failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

// Write CSV batch atomically
const insertImportBatch = async (documents) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    await Transaction.insertMany(documents, { session });
    await session.commitTransaction();
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch {
      // Nothing to roll back
    }

    if (error?.message?.includes("Transaction numbers are only allowed")) {
      await Transaction.insertMany(documents);
      return;
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

// POST /api/transactions/import/confirm
const confirmImport = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const result = await analyzeCsv(req.body?.csv, scope.organizationId);

    if (result.error) {
      return res.status(400).json({ message: result.error });
    }

    const importable = result.rows
      .filter((entry) => entry.status === "Valid")
      .map((entry) => ({ ...entry.data, organizationId: scope.organizationId, user: req.user._id }));

    if (importable.length > 0) {
      await insertImportBatch(importable);
    }

    return res.json({
      message:
        importable.length === 1
          ? "1 transaction imported successfully."
          : `${importable.length} transactions imported successfully.`,
      imported: importable.length,
      invalidSkipped: result.summary.invalid,
      duplicateSkipped: result.summary.duplicates,
    });
  } catch (error) {
    console.error("[transactions] CSV import failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  exportTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  validateTransaction,
  previewImport,
  confirmImport,
};

