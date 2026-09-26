/**
 * Shared display formatting (Part 4 - transactions page).
 *
 * The rupee symbol comes from Intl currency data (not a hand-typed literal),
 * so it can never be corrupted by file encoding issues.
 */

/** ₹75,000 / ₹1,234.5 - Indian grouping, no forced decimals. */
export const formatMoney = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return "-";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

/** 23/09/2026 - one consistent date format across the transactions page. */
export const formatDate = (value) => {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) return "-";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

/** 23/09/2026, 04:30 pm - used for createdAt / updatedAt metadata. */
export const formatDateTime = (value) => {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) return "-";

  return `${formatDate(date)}, ${date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
};

/** Today as a YYYY-MM-DD string for <input type="date"> defaults. */
export const todayInputValue = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
};

/** ISO date -> YYYY-MM-DD for <input type="date"> values (falls back to today). */
export const toDateInputValue = (value) => {
  if (!value) return todayInputValue();

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? todayInputValue() : date.toISOString().slice(0, 10);
};
