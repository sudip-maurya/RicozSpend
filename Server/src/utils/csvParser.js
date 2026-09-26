/**
 * CSV parsing + validation for transaction import (Part 5).
 *
 * Dependency-free on purpose: the uploaded CSV is read as TEXT on the client
 * and posted as JSON ({ csv: "..." }), so no multer/file-upload middleware is
 * needed and the existing JSON + JWT flow stays intact.
 *
 * Supported header row (case-insensitive, extra spaces tolerated):
 *   Amount, Vendor, Category, Department, Date, Description (optional)
 * Supported date formats: DD/MM/YYYY (primary) and YYYY-MM-DD.
 */

const REQUIRED_HEADERS = ["amount", "vendor", "category", "department", "date"];
const OPTIONAL_HEADERS = ["description"];
const VALID_HEADERS = [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS];

const MAX_ROWS = 5000; // safety cap so one upload cannot flood the database
const MAX_CSV_LENGTH = 2 * 1024 * 1024; // 2 MB of CSV text

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * Parse a CSV string into rows of cell values.
 * Handles: quoted fields, commas/quotes inside quotes, CRLF/LF, blank rows
 * (they are kept so preview row numbers match the file - callers skip them).
 */
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"'; // escaped quote inside a quoted field
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }

  // Final cell/row when the file does not end with a newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
};

/**
 * Map the header row to column indexes. Accepts capitalisation/spacing
 * differences ("Vendor Name", " amount ", "DEPARTMENT"...).
 * @returns {{ columns: object, missing: string[] }}
 */
const mapHeaders = (headerRow) => {
  const columns = {};
  const unknown = [];

  headerRow.forEach((rawCell, index) => {
    const cell = cleanText(rawCell).toLowerCase().replace(/[_-]/g, " ");

    if (VALID_HEADERS.includes(cell)) {
      if (columns[cell] === undefined) columns[cell] = index;
    } else {
      unknown.push(cleanText(rawCell));
    }
  });

  const missing = REQUIRED_HEADERS.filter((header) => columns[header] === undefined);

  return { columns, missing, unknown };
};

/** Parse DD/MM/YYYY (primary) or YYYY-MM-DD into a UTC-midnight Date or null. */
const parseCsvDate = (value) => {
  const text = cleanText(value);

  let day;
  let month;
  let year;

  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    [, day, month, year] = dmy;
  } else {
    const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!iso) return null;
    [, year, month, day] = iso;
  }

  day = Number(day);
  month = Number(month);
  year = Number(year);

  // Strict range check first, then a round-trip check so 31/02/2026 is invalid.
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
};

/**
 * Validate one CSV row with the SAME rules as Part 4 (single-transaction).
 * @returns {{ errors: string[], data?: object }}
 */
const validateRow = (cells, columns) => {
  const errors = [];
  const get = (name) => cleanText(cells[columns[name]]);

  // Amount: required, numeric, > 0.
  const rawAmount = get("amount");
  if (rawAmount === "") {
    errors.push("Amount is required");
  } else {
    const amount = Number(rawAmount);
    if (!Number.isFinite(amount)) {
      errors.push("Amount must be a number");
    } else if (amount <= 0) {
      errors.push("Amount must be greater than 0");
    }
  }

  if (get("vendor") === "") errors.push("Vendor is required");
  if (get("category") === "") errors.push("Category is required");
  if (get("department") === "") errors.push("Department is required");

  const date = parseCsvDate(get("date"));
  if (get("date") === "") {
    errors.push("Date is required");
  } else if (!date) {
    errors.push("Invalid date (use DD/MM/YYYY)");
  }

  if (errors.length > 0) return { errors };

  // Values are NOT silently altered beyond trimming (done by `get`).
  return {
    errors,
    data: {
      amount: Math.round(Number(rawAmount) * 100) / 100,
      vendor: get("vendor"),
      category: get("category"),
      department: get("department"),
      date,
      description: get("description"),
    },
  };
};

/**
 * Deterministic duplicate key from real transaction fields
 * (description is optional, so it is deliberately excluded).
 */
const buildDuplicateKey = (transaction) =>
  [
    cleanText(transaction.vendor).toLowerCase(),
    cleanText(transaction.category).toLowerCase(),
    cleanText(transaction.department).toLowerCase(),
    Number(transaction.amount),
    transaction.date instanceof Date
      ? transaction.date.toISOString().slice(0, 10)
      : new Date(transaction.date).toISOString().slice(0, 10),
  ].join("|");

module.exports = {
  REQUIRED_HEADERS,
  VALID_HEADERS,
  MAX_ROWS,
  MAX_CSV_LENGTH,
  parseCsv,
  mapHeaders,
  parseCsvDate,
  validateRow,
  buildDuplicateKey,
};
