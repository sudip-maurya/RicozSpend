/**
 * Dashboard controllers (Part 3 - spend overview).
 *
 * All heavy lifting happens in MongoDB aggregations so the client never
 * downloads the whole transaction collection. The read scope comes from the
 * the shared workspace (utils/spendScope): every authenticated user reads
 * the workspace's transactions - Admin and Viewer see the same numbers.
 *
 * GET /api/dashboard/summary?range=month|today|week|lastMonth|quarter|year|custom&from=&to=
 */

const Transaction = require("../models/Transaction");
const { spendScope } = require("../utils/spendScope");
const { shapeGroups } = require("../utils/aggregation");

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LIMIT = 8;

/** Start of the current day (UTC). */
const startOfToday = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * Resolve a `range` preset into an inclusive [from, to) UTC window.
 * Returns an `error` string for invalid input, or `null` bounds for all time.
 */
const resolveRange = (query) => {
  const range = String(query.range || "month").toLowerCase();

  if (range === "custom") {
    const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : null;
    const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : null;

    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      return { error: "Invalid custom date range. Use YYYY-MM-DD for from/to." };
    }

    if (to) to.setTime(to.getTime() + DAY_MS); // "to" is inclusive -> next midnight
    return { from: from || null, to: to || null };
  }

  const today = startOfToday();

  switch (range) {
    case "today":
      return { from: today, to: new Date(today.getTime() + DAY_MS) };
    case "week": {
      const weekday = (today.getUTCDay() + 6) % 7; // Monday = 0
      const from = new Date(today.getTime() - weekday * DAY_MS);
      return { from, to: new Date(today.getTime() + DAY_MS) };
    }
    case "month":
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
        to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)),
      };
    case "lastmonth":
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)),
        to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
      };
    case "quarter": {
      const quarterMonth = Math.floor(today.getUTCMonth() / 3) * 3;
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), quarterMonth, 1)),
        to: new Date(Date.UTC(today.getUTCFullYear(), quarterMonth + 3, 1)),
      };
    }
    case "year":
      return {
        from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)),
        to: new Date(Date.UTC(today.getUTCFullYear() + 1, 0, 1)),
      };
    default:
      // "all" and anything unknown -> no date restriction
      return { from: null, to: null };
  }
};

/** Build the $match stage for the current read scope + date window. */
const buildMatch = (scope, from, to) => {
  const match = { ...scope };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lt = to;
  }
  return match;
};

/**
 * GET /api/dashboard/summary
 * One authenticated endpoint that powers the whole Part 3 dashboard.
 */
const getSummary = async (req, res) => {
  try {
    const range = resolveRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const { from, to } = range;
    // Workspace-wide: every authenticated user reads the shared workspace data.
    const match = buildMatch(spendScope(req.user), from, to);

    const [totals, monthly, categories, departments, vendors, recent] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: "$amount" },
            transactionCount: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            // P1-4: pin month grouping to UTC so it matches the UTC-normalized
            // storage and the budget month windows (was server-local timezone).
            _id: {
              year: { $year: { date: "$date", timezone: "UTC" } },
              month: { $month: { date: "$date", timezone: "UTC" } },
            },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
      Transaction.aggregate([
        { $match: match },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: match },
        { $group: { _id: "$department", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: match },
        { $group: { _id: "$vendor", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 1 },
      ]),
      Transaction.find(match).sort({ date: -1 }).limit(RECENT_LIMIT).select("-user"),
    ]);

    const totalRow = totals[0] || { totalSpend: 0, transactionCount: 0 };
    const categoryGroups = shapeGroups(categories);
    const departmentGroups = shapeGroups(departments);
    const vendorGroups = shapeGroups(vendors);

    return res.json({
      range: {
        preset: String(req.query.range || "month").toLowerCase(),
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      totalSpend: Number(totalRow.totalSpend.toFixed(2)),
      transactionCount: totalRow.transactionCount,
      topVendor: vendorGroups[0] || null,
      topCategory: categoryGroups[0] || null,
      monthlySpend: monthly.map((row) => ({
        name: `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
        total: Number(row.total.toFixed(2)),
      })),
      categorySpend: categoryGroups,
      departmentSpend: departmentGroups,
      recentTransactions: recent,
    });
  } catch (error) {
    console.error("[dashboard] Failed to build summary:", error.message);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
};

module.exports = {
  getSummary,
  resolveRange,
};