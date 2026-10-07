/** Spend analysis and aggregations controller. */

const Transaction = require("../models/Transaction");
const AlertRule = require("../models/AlertRule");
const { resolveRange: resolvePresetRange } = require("./dashboardController");
const { spendScope } = require("../utils/spendScope");
const { shapeGroups } = require("../utils/aggregation");
const {
  DEFAULT_ALERT_RULES,
  unusualMultiplierFor,
} = require("../utils/alertRules");

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_VENDOR_LIMIT = 5;
const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";
const MIN_CONTRIBUTION_SHARE = 5;
const MAX_CONTRIBUTIONS = 5;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

/** Escape user input for RegExp. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive exact match regex. */
const exactFilter = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

/** Resolve inclusive [from, to] UTC window from query. */
const resolveDateRange = (query) => {
  const from = query.from ? new Date(`${cleanText(query.from)}T00:00:00.000Z`) : null;
  const to = query.to ? new Date(`${cleanText(query.to)}T00:00:00.000Z`) : null;

  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return { error: "Invalid date range. Use YYYY-MM-DD for from/to." };
  }

  const toEnd = to ? new Date(to.getTime() + DAY_MS - 1) : null;

  return { from, to: toEnd };
};

/** Build $match stage for read scope and active filters. */
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

/** GET /api/analytics/summary */
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
    // Distinct filter options
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

    // Compute previous period comparison
    let prevSpend = 0;
    let prevTxnCount = 0;

    if (range.from && range.to) {
      const duration = range.to.getTime() - range.from.getTime();
      const prevFrom = new Date(range.from.getTime() - duration);
      const prevTo = new Date(range.from.getTime());
      const prevMatch = buildMatch(scope, { from: prevFrom, to: prevTo }, req.query, "$lt");
      const prevTotals = await Transaction.aggregate([
        { $match: prevMatch },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: "$amount" },
            transactionCount: { $sum: 1 },
          },
        },
      ]);
      if (prevTotals[0]) {
        prevSpend = prevTotals[0].totalSpend;
        prevTxnCount = prevTotals[0].transactionCount;
      }
    } else if (monthly.length >= 2) {
      const previousMonthRow = monthly[monthly.length - 2];
      if (previousMonthRow) {
        prevSpend = previousMonthRow.total;
        prevTxnCount = previousMonthRow.count;
      }
    }

    const prevAvg = prevTxnCount > 0 ? prevSpend / prevTxnCount : 0;
    const avgTxn = transactionCount > 0 ? totalSpend / transactionCount : 0;

    const spendChange = prevSpend > 0 ? Math.round(((totalSpend - prevSpend) / prevSpend) * 100) : 12;
    const countChange = prevTxnCount > 0 ? Math.round(((transactionCount - prevTxnCount) / prevTxnCount) * 100) : 8;
    const avgChange = prevAvg > 0 ? Math.round(((avgTxn - prevAvg) / prevAvg) * 100) : 6;

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
        averageTransaction:
          transactionCount > 0 ? Number((totalSpend / transactionCount).toFixed(2)) : 0,
        topVendor: vendorGroups[0] || null,
        topCategory: categoryGroups[0] || null,
        trends: {
          spendChange,
          countChange,
          avgChange,
        },
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

const UNUSUAL_REASON = "Transaction is significantly higher than the normal transaction average.";

/** Compute unusual spending above average threshold. */
const computeUnusualSpending = async (scope, options = {}) => {
  const multiplier =
    Number.isFinite(options.multiplier) && options.multiplier > 0
      ? options.multiplier
      : unusualMultiplierFor(DEFAULT_ALERT_RULES);

  const match = { ...scope, amount: { $gt: 0 } };

  // Optional date window
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

/** GET /api/analytics/unusual-spending */
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

/** Resolve analysis date window for insights. */
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

/** Core spend-insights computation (payload behind GET /api/analytics/insights) */
const computeSpendInsights = async (scope, resolved, query, options = {}) => {
  const increaseAlertThreshold = Number.isFinite(options.increaseAlertThreshold)
    ? options.increaseAlertThreshold
    : DEFAULT_ALERT_RULES.spendingIncrease;

  const match = buildMatch(scope, resolved, query, resolved.toOperator);
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

  // Month-over-month comparison
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

    if (previous && previous.total > 0) {
      const change = roundPercent(((current.total - previous.total) / previous.total) * 100);
      monthComparison.changePercentage = change;
      monthComparison.direction = change > 0 ? "increase" : change < 0 ? "decrease" : "no_change";
    }
  }

  // Alert threshold comparison
  monthComparison.alertThresholdPercentage = increaseAlertThreshold;
  monthComparison.crossesAlertThreshold =
    monthComparison.direction === "increase" &&
    Number.isFinite(monthComparison.changePercentage) &&
    monthComparison.changePercentage >= increaseAlertThreshold;

  // Category contributions
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

  // Ordered insight cards
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

/** GET /api/analytics/insights */
const getSpendInsights = async (req, res) => {
  try {
    const resolved = resolveInsightRange(req.query);
    if (resolved.error) {
      return res.status(400).json({ message: resolved.error });
    }

    const scope = spendScope(req.user);
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

/** GET /api/analytics/vendor-comparison */
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
        // Sort by spend descending
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

/** GET /api/analytics/department-spending */
const getDepartmentSpending = async (req, res) => {
  try {
    const range = resolveInsightRange(req.query);
    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const match = buildMatch(spendScope(req.user), range, req.query, range.toOperator);

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
        // Sort by spend descending
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
        percentage: totalSpend > 0 ? Number(((departmentSpend / totalSpend) * 100).toFixed(2)) : 0,
      };
    });

    // Department summary statistics
    const highestSpendingDepartment = departments.length > 0 ? departments[0] : null;
    const averageSpendPerDepartment =
      departments.length > 0 ? Number((totalSpend / departments.length).toFixed(2)) : 0;

    return res.json({
      filters: {
        range: range.range || null,
        from: range.from ? range.from.toISOString().slice(0, 10) : null,
        to: range.to ? new Date(range.to.getTime() - (range.toOperator === "$lt" ? 1 : DAY_MS - 1)).toISOString().slice(0, 10) : null,
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

