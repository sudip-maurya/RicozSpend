/**
 * Analytics controllers (Part 6 - spend analysis & charts).
 *
 * One authenticated endpoint powers the analysis page. Everything is computed
 * with MongoDB aggregations (same approach as the Part 3 dashboard), using the
 * shared read scope (utils/spendScope): every authenticated user reads the
 * workspace's transactions - Admin and Viewer see the same numbers.
 *
 * GET /api/analytics/summary?from=&to=&category=&department=&vendor=
 */

const Transaction = require("../models/Transaction");
const AlertRule = require("../models/AlertRule");
// Reuse the Part 3 date-range presets so the dashboard's own filter drives the
// insights (no second filtering system).
const { resolveRange: resolvePresetRange } = require("./dashboardController");
// Same read scope rule as the dashboard: the shared workspace scope.
const { spendScope } = require("../utils/spendScope");
const { shapeGroups } = require("../utils/aggregation");
// Part 15: the alert thresholds are Admin-configurable (Alerts Center -> Alert Rules editor).
const {
  DEFAULT_ALERT_RULES,
  unusualMultiplierFor,
} = require("../utils/alertRules");

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_VENDOR_LIMIT = 5;
const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";
/** Part 8: only categories worth mentioning, so V1 output stays concise. */
const MIN_CONTRIBUTION_SHARE = 5;
const MAX_CONTRIBUTIONS = 5;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

/** Escape user input before building a case-insensitive RegExp. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Exact, case-insensitive match for category/department/vendor filters. */
const exactFilter = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

/**
 * Resolve the inclusive [from, to] UTC window from YYYY-MM-DD strings.
 * Returns an `error` string for invalid input, or null bounds for all time.
 */
const resolveDateRange = (query) => {
  const from = query.from ? new Date(`${cleanText(query.from)}T00:00:00.000Z`) : null;
  const to = query.to ? new Date(`${cleanText(query.to)}T00:00:00.000Z`) : null;

  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return { error: "Invalid date range. Use YYYY-MM-DD for from/to." };
  }

  // "to" is inclusive -> extend to the end of that day (same rule as Part 4).
  const toEnd = to ? new Date(to.getTime() + DAY_MS - 1) : null;

  return { from, to: toEnd };
};

/**
 * Build the $match stage for the current read scope + active filters.
 *
 * `toOperator` lets callers choose how the upper date bound is applied:
 * Part 6 passes an inclusive end-of-day (-> $lte), while Part 8 passes the
 * Part 3 range presets whose `to` is the exclusive next midnight (-> $lt).
 * The default keeps Part 6 behaviour exactly as it was.
 */
const buildMatch = (scope, range, query, toOperator = "$lte") => {
  const match = { ...scope };

  if (range.from || range.to) {
    match.date = {};
    if (range.from) match.date.$gte = range.from;
    if (range.to) match.date[toOperator] = range.to;
  }

  const category = cleanText(query.category);
  if (category) match.category = exactFilter(category);

  const department = cleanText(query.department);
  if (department) match.department = exactFilter(department);

  const vendor = cleanText(query.vendor);
  if (vendor) match.vendor = exactFilter(vendor);

  return match;
};

/* ------------------------------------------------------------ main handler */

/**
 * GET /api/analytics/summary
 * Returns KPIs + category/department/vendor/monthly aggregations for the
 * authenticated user, honouring the from/to/category/department/vendor filters.
 */
const getAnalyticsSummary = async (req, res) => {
  try {
    const range = resolveDateRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const filters = {
      category: cleanText(req.query.category),
      department: cleanText(req.query.department),
      vendor: cleanText(req.query.vendor),
    };

    const match = buildMatch(spendScope(req.user), range, req.query);
    // Filter dropdown options: the scoped distinct values, independent of the
    // active filters, so the lists stay stable while filtering.
    const scope = spendScope(req.user);

    const [totals, categories, departments, vendors, monthly, facetCategories, facetDepartments, facetVendors] =
      await Promise.all([
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
          { $limit: TOP_VENDOR_LIMIT },
        ]),
        Transaction.aggregate([
          { $match: match },
          {
            $group: {
              // P1-4: pin month grouping to UTC (was server-local timezone).
              _id: {
                year: { $year: { date: "$date", timezone: "UTC" } },
                month: { $month: { date: "$date", timezone: "UTC" } },
              },
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
          // Chronological order by year then month (never alphabetical names).
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),
        Transaction.distinct("category", scope),
        Transaction.distinct("department", scope),
        Transaction.distinct("vendor", scope),
      ]);

    const totalRow = totals[0] || { totalSpend: 0, transactionCount: 0 };
    const totalSpend = Number(totalRow.totalSpend.toFixed(2));
    const transactionCount = totalRow.transactionCount;

    const categoryGroups = shapeGroups(categories);
    const departmentGroups = shapeGroups(departments);
    const vendorGroups = shapeGroups(vendors);

    return res.json({
      filters: {
        from: range.from ? range.from.toISOString().slice(0, 10) : null,
        to: range.to ? new Date(range.to.getTime() - DAY_MS + 1).toISOString().slice(0, 10) : null,
        category: filters.category || null,
        department: filters.department || null,
        vendor: filters.vendor || null,
      },
      kpis: {
        totalSpend,
        transactionCount,
        // Safe for zero transactions: dividing by 0 would produce NaN.
        averageTransaction:
          transactionCount > 0 ? Number((totalSpend / transactionCount).toFixed(2)) : 0,
        topVendor: vendorGroups[0] || null,
        topCategory: categoryGroups[0] || null,
      },
      categorySpend: categoryGroups,
      departmentSpend: departmentGroups,
      vendorSpend: vendorGroups,
      monthlyTrend: monthly.map((row) => ({
        key: `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
        name: `${MONTH_NAMES[row._id.month - 1]} ${row._id.year}`,
        total: Number(row.total.toFixed(2)),
        count: row.count,
      })),
      facets: {
        categories: facetCategories.filter(Boolean).sort(),
        departments: facetDepartments.filter(Boolean).sort(),
        vendors: facetVendors.filter(Boolean).sort(),
      },
    });
  } catch (error) {
    console.error("[analytics] Failed to build summary:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/* ------------------------------------------- Part 7 - unusual spending ----- */

/** Business-friendly reason shown with every unusual transaction. */
const UNUSUAL_REASON = "Transaction is significantly higher than the normal transaction average.";

/**
 * Core Part 7 computation, extracted so the Part 14 Alerts & Insights Center
 * can reuse the exact same rule (average x multiplier) instead of duplicating
 * it. `scope` is the caller's spendScope; `options.multiplier` comes from the
 * Admin-configured "Unusual Spending" rule (default: 50% above average = 1.5x).
 * Returns the same payload the endpoint returns.
 */
const computeUnusualSpending = async (scope, options = {}) => {
  const multiplier =
    Number.isFinite(options.multiplier) && options.multiplier > 0
      ? options.multiplier
      : unusualMultiplierFor(DEFAULT_ALERT_RULES);

  // amount > 0 keeps zero/invalid rows (if any ever reach the DB) out of the
  // average so they can never skew or break the calculation.
  const match = { ...scope, amount: { $gt: 0 } };

  // P2-8: optional date window so the dashboard can scope unusual spending to
  // its selected range. Accepts the dashboard presets (exclusive upper bound)
  // or explicit from/to dates (inclusive), via resolveInsightRange.
  if (options.from || options.to) {
    match.date = {};
    if (options.from) match.date.$gte = options.from;
    if (options.to) match.date[options.toOperator || '$lte'] = options.to;
  }

  const [totals] = await Transaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        averageAmount: { $avg: "$amount" },
        transactionCount: { $sum: 1 },
      },
    },
  ]);

  const transactionCount = totals?.transactionCount || 0;
  // No transactions -> average 0 / threshold 0 / no alerts (safe defaults).
  const averageTransaction = totals ? Number(totals.averageAmount.toFixed(2)) : 0;
  const threshold = Number((averageTransaction * multiplier).toFixed(2));

  const unusual = await Transaction.find({ ...match, amount: { $gt: threshold } })
    .sort({ amount: -1 })
    .select("-user");

  return {
    transactionCount,
    averageTransaction,
    threshold,
    multiplier,
    percentAboveAverage: Number(((multiplier - 1) * 100).toFixed(1)),
    unusualCount: unusual.length,
    unusualTransactions: unusual.map((tx) => ({
      ...tx.toJSON(),
      differenceFromAverage: Number((tx.amount - averageTransaction).toFixed(2)),
      reason: UNUSUAL_REASON,
    })),
  };
};

/**
 * GET /api/analytics/unusual-spending
 *
 * Basic rule-based alerts (no AI/statistics): average transaction amount of the
 * workspace's transactions x the Admin-configured multiplier (default 1.5 =
 * "50% above average"); every transaction strictly above that threshold is an
 * alert. Computed on demand from the existing transactions collection - no
 * extra collection and no stored state.
 */
const getUnusualSpending = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const rules = await AlertRule.findEffectiveRules(scope.organizationId);
    const range = resolveInsightRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    return res.json(
      await computeUnusualSpending(scope, {
        multiplier: unusualMultiplierFor(rules),
        from: range.from,
        to: range.to,
        toOperator: range.toOperator,
      })
    );
  } catch (error) {
    console.error("[analytics] Unusual spending failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/* ------------------------------------ Part 8 - automatic spend insights --- */

/**
 * Resolve the analysis window for the insights endpoint.
 *
 * 1. Explicit `from`/`to` (YYYY-MM-DD) -> same inclusive rule as Part 6 ($lte).
 * 2. A Part 3 dashboard preset (`range=month|week|...|custom`) -> the dashboard's
 *    own filter is reused, so insights never build a second filtering system
 *    (`to` there is the exclusive next midnight -> $lt).
 * 3. Nothing at all -> every available transaction.
 */
const resolveInsightRange = (query) => {
  const hasExplicitDates = Boolean(cleanText(query.from) || cleanText(query.to));

  if (hasExplicitDates) {
    const range = resolveDateRange(query);
    if (range.error) return { error: range.error };
    return { from: range.from, to: range.to, range: null, toOperator: "$lte" };
  }

  const preset = cleanText(query.range);
  if (preset) {
    const range = resolvePresetRange(query);
    if (range.error) return { error: range.error };
    return { from: range.from, to: range.to, range: preset.toLowerCase(), toOperator: "$lt" };
  }

  return { from: null, to: null, range: null, toOperator: "$lte" };
};

/** 18.4 -> 18.4, 18 -> 18 (never "18.0"). */
const roundPercent = (value) => Number(value.toFixed(1));

/** "2026-09" -> "Sep 2026". */
const monthLabel = (key) => {
  const [year, month] = key.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};

/** The calendar month immediately before a "YYYY-MM" key. */
const previousMonthKey = (key) => {
  const [year, month] = key.split("-").map(Number);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
};

/**
 * Core Part 8 spend-insights computation (the payload behind
 * GET /api/analytics/insights), extracted so the Part 14 Alerts & Insights
 * Center reuses the exact same aggregations instead of duplicating them.
 * Returns the payload without `filters` (the HTTP wrapper shapes those from
 * the same `resolved` object).
 *
 * Automatic spend insights built only from deterministic rules over the
 * user's real transactions - no AI, no predictions, no stored state:
 *
 *  - month over month: latest month with data vs the calendar month before it
 *    (the comparison deliberately ignores the date filter, otherwise the
 *    default "This Month" dashboard view could never compare anything, but it
 *    still honours the category/department/vendor filters)
 *  - top category / vendor / department by total spend
 *  - category contribution: share of total spend for categories >= 5%
 *  - transaction activity: how many transactions are in the selected period
 *
 * `options.increaseAlertThreshold` is the Admin-configured "Spending Increase"
 * percentage (Part 15). It is reported additively on `monthComparison`
 * (alertThresholdPercentage / crossesAlertThreshold); `direction` keeps its
 * factual meaning, so the insight cards are unaffected.
 */
const computeSpendInsights = async (scope, resolved, query, options = {}) => {
  const increaseAlertThreshold = Number.isFinite(options.increaseAlertThreshold)
    ? options.increaseAlertThreshold
    : DEFAULT_ALERT_RULES.spendingIncrease;

  const match = buildMatch(scope, resolved, query, resolved.toOperator);
  // Same filters, no date window (see the month-over-month note above).
  const comparisonMatch = buildMatch(scope, { from: null, to: null }, query);

  const [totals, categories, departments, vendors, monthly] = await Promise.all([
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: null, totalSpend: { $sum: "$amount" }, count: { $sum: 1 } } },
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
    ]),
    Transaction.aggregate([
      { $match: comparisonMatch },
      {
        $group: {
          // P1-4: pin month grouping to UTC (was server-local timezone).
          _id: {
            year: { $year: { date: "$date", timezone: "UTC" } },
            month: { $month: { date: "$date", timezone: "UTC" } },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);


  const totalRow = totals[0] || { totalSpend: 0, count: 0 };
  const totalSpend = Number(totalRow.totalSpend.toFixed(2));
  const transactionCount = totalRow.count;

  const categoryGroups = shapeGroups(categories);
  const departmentGroups = shapeGroups(departments);
  const vendorGroups = shapeGroups(vendors);

  const topCategory = categoryGroups[0] || null;
  const topVendor = vendorGroups[0] || null;
  const topDepartment = departmentGroups[0] || null;

  /* --- Insight 1: latest month with data vs the month before it --------- */
  const monthTotals = new Map(
    monthly.map((row) => [
      `${row._id.year}-${String(row._id.month).padStart(2, "0")}`,
      { total: Number(row.total.toFixed(2)), count: row.count },
    ])
  );
  const monthKeys = [...monthTotals.keys()].sort();
  const latestKey = monthKeys[monthKeys.length - 1] || null;

  const monthComparison = {
    currentMonth: null,
    previousMonth: null,
    currentSpend: 0,
    previousSpend: null,
    changePercentage: null,
    direction: "insufficient_data",
  };

  if (latestKey) {
    const current = monthTotals.get(latestKey);
    const prevKey = previousMonthKey(latestKey);
    const previous = monthTotals.get(prevKey) || null;

    monthComparison.currentMonth = monthLabel(latestKey);
    monthComparison.previousMonth = monthLabel(prevKey);
    monthComparison.currentSpend = current.total;
    monthComparison.previousSpend = previous ? previous.total : null;

    // A real comparison only exists when the immediately previous calendar
    // month actually has spending. Nothing is invented otherwise.
    if (previous && previous.total > 0) {
      const change = roundPercent(((current.total - previous.total) / previous.total) * 100);
      monthComparison.changePercentage = change;
      monthComparison.direction = change > 0 ? "increase" : change < 0 ? "decrease" : "no_change";
    }
  }

  // Part 15: how the Admin-configured "Spending Increase" rule judges the trend
  // (an increase below the configured percentage is informative, not an alert).
  monthComparison.alertThresholdPercentage = increaseAlertThreshold;
  monthComparison.crossesAlertThreshold =
    monthComparison.direction === "increase" &&
    Number.isFinite(monthComparison.changePercentage) &&
    monthComparison.changePercentage >= increaseAlertThreshold;

  /* --- Insight 5: how much of the total each major category represents -- */
  const categoryContributions = categoryGroups
    .filter((group) => totalSpend > 0 && (group.total / totalSpend) * 100 >= MIN_CONTRIBUTION_SHARE)
    .slice(0, MAX_CONTRIBUTIONS)
    .map((group) => ({
      name: group.name,
      total: group.total,
      count: group.count,
      share: roundPercent((group.total / totalSpend) * 100),
    }));

  const transactionActivity = {
    count: transactionCount,
    totalSpend,
    averageTransaction:
      transactionCount > 0 ? Number((totalSpend / transactionCount).toFixed(2)) : 0,
  };

  /* --- Ordered insight cards (empty when there is nothing to analyse) --- */
  const insights = [];

  if (transactionCount > 0) {
    const trendTone =
      monthComparison.direction === "increase"
        ? "warning"
        : monthComparison.direction === "decrease"
          ? "positive"
          : "neutral";

    insights.push({
      id: "month-trend",
      kind: "monthComparison",
      label: "Spending Trend",
      tone: trendTone,
      direction: monthComparison.direction,
      currentMonth: monthComparison.currentMonth,
      previousMonth: monthComparison.previousMonth,
      currentSpend: monthComparison.currentSpend,
      previousSpend: monthComparison.previousSpend,
      changePercentage: monthComparison.changePercentage,
    });

    if (topCategory) {
      insights.push({
        id: "top-category",
        kind: "topCategory",
        label: "Top Category",
        tone: "neutral",
        name: topCategory.name,
        amount: topCategory.total,
        count: topCategory.count,
      });
    }

    if (topDepartment) {
      insights.push({
        id: "top-department",
        kind: "topDepartment",
        label: "Top Department",
        tone: "neutral",
        name: topDepartment.name,
        amount: topDepartment.total,
        count: topDepartment.count,
      });
    }

    if (topVendor) {
      insights.push({
        id: "top-vendor",
        kind: "topVendor",
        label: "Top Vendor",
        tone: "neutral",
        name: topVendor.name,
        amount: topVendor.total,
        count: topVendor.count,
      });
    }

    if (categoryContributions.length > 0) {
      insights.push({
        id: "category-contribution",
        kind: "categoryContribution",
        label: "Category Contribution",
        tone: "neutral",
      });
    }

    insights.push({
      id: "activity",
      kind: "transactionActivity",
      label: "Transaction Activity",
      tone: "neutral",
      count: transactionCount,
      amount: totalSpend,
    });
  }

  return {
    monthComparison,
    topCategory,
    topVendor,
    topDepartment,
    categoryContributions,
    transactionActivity,
    insights,
  };
};

/**
 * GET /api/analytics/insights?range=&from=&to=&category=&department=&vendor=
 * Thin HTTP wrapper: range validation + response shaping around the shared
 * computeSpendInsights() helper (also used by the Part 14 Alerts & Insights
 * Center).
 */
const getSpendInsights = async (req, res) => {
  try {
    const resolved = resolveInsightRange(req.query);
    if (resolved.error) {
      return res.status(400).json({ message: resolved.error });
    }

    const scope = spendScope(req.user);
    // Part 15: the month-over-month alert threshold is Admin-configurable.
    const rules = await AlertRule.findEffectiveRules(scope.organizationId);

    const payload = await computeSpendInsights(scope, resolved, req.query, {
      increaseAlertThreshold: rules.spendingIncrease,
    });

    return res.json({
      filters: {
        range: resolved.range,
        from: resolved.from ? resolved.from.toISOString().slice(0, 10) : null,
        to: resolved.to ? new Date(resolved.to.getTime() - 1).toISOString().slice(0, 10) : null,
        category: cleanText(req.query.category) || null,
        department: cleanText(req.query.department) || null,
        vendor: cleanText(req.query.vendor) || null,
      },
      ...payload,
    });
  } catch (error) {
    console.error("[analytics] Failed to build spend insights:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/* ------------------------------------------------ Part 9 vendor comparison */

/**
 * GET /api/analytics/vendor-comparison?from=&to=&category=&department=&vendor=
 *
 * Descriptive vendor comparison for the authenticated user: per vendor spend,
 * transaction count and share of total spend. Purely factual - no ranking
 * language, no recommendations.
 *
 * Reuses the exact same date window + filter helpers as the rest of the
 * analytics area (no second filtering system) and is grouped by the existing
 * `vendor` field. Vendors are sorted by total spend descending, so the
 * highest-spending vendor always comes first.
 */
const getVendorComparison = async (req, res) => {
  try {
    const range = resolveDateRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const match = buildMatch(spendScope(req.user), range, req.query);

    const [groups, totals] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$vendor",
            totalSpend: { $sum: "$amount" },
            transactionCount: { $sum: 1 },
          },
        },
        // Highest spend first; ties resolved by name so results are reproducible.
        { $sort: { totalSpend: -1, _id: 1 } },
      ]),
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
    ]);

    const totalRow = totals[0] || { totalSpend: 0, transactionCount: 0 };
    const totalSpend = Number(totalRow.totalSpend.toFixed(2));
    const totalTransactions = totalRow.transactionCount;

    const vendors = groups.map((row) => {
      const vendorSpend = Number(row.totalSpend.toFixed(2));

      return {
        name: row._id || "Unknown",
        totalSpend: vendorSpend,
        transactionCount: row.transactionCount,
        // Zero total spend (no matching rows) must not divide by zero.
        percentage: totalSpend > 0 ? Number(((vendorSpend / totalSpend) * 100).toFixed(2)) : 0,
      };
    });

    return res.json({
      filters: {
        from: range.from ? range.from.toISOString().slice(0, 10) : null,
        to: range.to ? new Date(range.to.getTime() - DAY_MS + 1).toISOString().slice(0, 10) : null,
        category: cleanText(req.query.category) || null,
        department: cleanText(req.query.department) || null,
        vendor: cleanText(req.query.vendor) || null,
      },
      totalSpend,
      totalTransactions,
      vendorCount: vendors.length,
      vendors,
    });
  } catch (error) {
    console.error("[analytics] Failed to build the vendor comparison:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/* ------------------------------------- Part 10 department spending patterns */

/**
 * GET /api/analytics/department-spending?from=&to=&category=&department=&vendor=
 *
 * Descriptive department spending for the authenticated user: per department
 * total spend, transaction count and share of total spend. Purely factual -
 * no ranking language, no recommendations.
 *
 * Mirrors the Part 9 vendor comparison, grouped by the existing `department`
 * (cost centre) field instead of `vendor`. Reuses the exact same date window
 * + filter helpers (no second filtering system). Departments are sorted by
 * total spend descending, so the highest-spending department comes first.
 *
 * Part 13 additionally returns `highestSpendingDepartment` and
 * `averageSpendPerDepartment`, both derived from the same aggregation below
 * (no extra query, no second calculation path) for the dedicated Department
 * Spending Patterns page. Additive fields only - Part 10 consumers keep
 * working unchanged.
 */
const getDepartmentSpending = async (req, res) => {
  try {
    const range = resolveDateRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const match = buildMatch(spendScope(req.user), range, req.query);

    const [groups, totals] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$department",
            totalSpend: { $sum: "$amount" },
            transactionCount: { $sum: 1 },
          },
        },
        // Highest spend first; ties resolved by name so results are reproducible.
        { $sort: { totalSpend: -1, _id: 1 } },
      ]),
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
    ]);

    const totalRow = totals[0] || { totalSpend: 0, transactionCount: 0 };
    const totalSpend = Number(totalRow.totalSpend.toFixed(2));
    const totalTransactions = totalRow.transactionCount;

    const departments = groups.map((row) => {
      const departmentSpend = Number(row.totalSpend.toFixed(2));

      return {
        name: row._id || "Unknown",
        totalSpend: departmentSpend,
        transactionCount: row.transactionCount,
        // Zero total spend (no matching rows) must not divide by zero.
        percentage: totalSpend > 0 ? Number(((departmentSpend / totalSpend) * 100).toFixed(2)) : 0,
      };
    });

    // Part 13: summary stats for the Department Spending Patterns page.
    // Rows are already sorted by spend descending, so the first row IS the
    // highest-spending department; the average divides the same total by the
    // department count. Zero departments -> null / 0 (never NaN), and both
    // values come from the aggregations above (no second query).
    const highestSpendingDepartment = departments.length > 0 ? departments[0] : null;
    const averageSpendPerDepartment =
      departments.length > 0 ? Number((totalSpend / departments.length).toFixed(2)) : 0;

    return res.json({
      filters: {
        from: range.from ? range.from.toISOString().slice(0, 10) : null,
        to: range.to ? new Date(range.to.getTime() - DAY_MS + 1).toISOString().slice(0, 10) : null,
        category: cleanText(req.query.category) || null,
        department: cleanText(req.query.department) || null,
        vendor: cleanText(req.query.vendor) || null,
      },
      totalSpend,
      totalTransactions,
      departmentCount: departments.length,
      highestSpendingDepartment,
      averageSpendPerDepartment,
      departments,
    });
  } catch (error) {
    console.error("[analytics] Failed to build the department spending:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

module.exports = {
  getAnalyticsSummary,
  resolveDateRange,
  resolveInsightRange,
  computeSpendInsights,
  computeUnusualSpending,
  getUnusualSpending,
  getSpendInsights,
  getVendorComparison,
  getDepartmentSpending,
};

