const { isValidObjectId } = require("mongoose");

const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
// DATA OWNERSHIP = WORKSPACE: reads and writes below are scoped to the
// caller's organizationId; `user`/`createdBy` are audit information (who
// created the record). Write permissions stay role-based (see routes).
const { spendScope } = require("../utils/spendScope");
const { budgetAlertLevel } = require("../utils/alertRules");
const AlertRule = require("../models/AlertRule");

const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";
const PERIOD_PATTERN = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;

const cleanText = (value) => (typeof value === "string" ? value.trim() : "");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactFilter = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

const round2 = (value) => Number(Number(value).toFixed(2));

const monthWindow = (period) => {
  const [year, month] = period.split("-").map(Number);
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  return { from, to };
};

const validateBudget = (payload = {}) => {
  const errors = {};

  const department = cleanText(payload.department);
  if (!department) {
    errors.department = "Cost centre / department is required.";
  }

  const category = cleanText(payload.category || "");

  const rawAmount = payload.amount;
  const amount =
    typeof rawAmount === "string" && rawAmount.trim() !== "" ? Number(rawAmount) : rawAmount;
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    errors.amount = "Budget amount is required.";
  } else if (typeof amount !== "number" || !Number.isFinite(amount)) {
    errors.amount = "Budget amount must be a valid number.";
  } else if (amount <= 0) {
    errors.amount = "Budget amount must be greater than 0.";
  }

  const period = cleanText(payload.period);
  if (!period) {
    errors.period = "Budget period is required.";
  } else if (!PERIOD_PATTERN.test(period)) {
    errors.period = "Budget period must be a valid month (YYYY-MM).";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return { errors, data: { department, category, amount: round2(amount), period } };
};

const findWorkspaceBudget = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    res.status(404).json({ message: "Budget not found." });
    return null;
  }

  const budget = await Budget.findOne({ _id: id, ...spendScope(req.user) });

  if (!budget) {
    res.status(404).json({ message: "Budget not found." });
    return null;
  }

  return budget;
};

const isDuplicateKeyError = (error) =>
  error && (error.code === 11000 || String(error.message || "").includes("duplicate"));


/**
 * POST /api/budgets (Admin only - enforced in the routes)
 */
const createBudget = async (req, res) => {
  const { errors, data } = validateBudget(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Please check the highlighted fields and try again.",
      errors,
    });
  }

  try {
    const budget = await Budget.create({
      ...data,
      organizationId: spendScope(req.user).organizationId,
      user: req.user._id,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: "Budget created successfully.",
      budget,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        message: "A budget already exists for this department, category and period.",
      });
    }

    if (error.name === "ValidationError") {
      const fieldErrors = {};
      Object.values(error.errors || {}).forEach((entry) => {
        if (entry.path) fieldErrors[entry.path] = entry.message;
      });
      return res.status(400).json({
        message: "Please check the highlighted fields and try again.",
        errors: fieldErrors,
      });
    }

    console.error("[budgets] Create failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * GET /api/budgets?period=&department=&category=
 * Lists the workspace's budgets (newest period first) - identical for Admin
 * and Viewer. Write access stays Admin-only via requireRole in the routes.
 */
const getBudgets = async (req, res) => {
  try {
    const filter = { ...spendScope(req.user) };

    const period = cleanText(req.query.period);
    if (period) {
      if (!PERIOD_PATTERN.test(period)) {
        return res.status(400).json({ message: "Budget period must be a valid month (YYYY-MM)." });
      }
      filter.period = period;
    }

    const department = cleanText(req.query.department);
    if (department) filter.department = exactFilter(department);

    const category = cleanText(req.query.category);
    if (category) filter.category = exactFilter(category);

    const budgets = await Budget.find(filter).sort({ period: -1, department: 1, category: 1 });

    return res.json({ budgets });
  } catch (error) {
    console.error("[budgets] List failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * PUT /api/budgets/:id (Admin only - enforced in the routes)
 */
const updateBudget = async (req, res) => {
  const { errors, data } = validateBudget(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Please check the highlighted fields and try again.",
      errors,
    });
  }

  try {
    const existing = await findWorkspaceBudget(req, res);
    if (!existing) return;

    existing.department = data.department;
    existing.category = data.category;
    existing.amount = data.amount;
    existing.period = data.period;
    await existing.save();

    return res.json({
      message: "Budget updated successfully.",
      budget: existing,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        message: "A budget already exists for this department, category and period.",
      });
    }

    console.error("[budgets] Update failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * DELETE /api/budgets/:id (Admin only - enforced in the routes)
 */
const deleteBudget = async (req, res) => {
  try {
    const existing = await findWorkspaceBudget(req, res);
    if (!existing) return;

    await existing.deleteOne();

    return res.json({ message: "Budget deleted successfully." });
  } catch (error) {
    console.error("[budgets] Delete failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/* ---------------------------------------------- budget vs actual (Part 9) */

const ON_TRACK_LABEL = "On Track";
const WARNING_LABEL = "Warning";
const CRITICAL_LABEL = "Critical";
const OVER_BUDGET_LABEL = "Over Budget";

// Deprecated aliases kept for backwards compatibility
const UNDER_BUDGET_LABEL = ON_TRACK_LABEL;
const NEAR_BUDGET_LABEL = WARNING_LABEL;

/**
 * Purely descriptive label - no ranking, scoring or recommendations.
 * Driven by the admin-configurable alert rules (single source of truth
 * via budgetAlertLevel). "Over Budget" only appears when usage >= 100%.
 * Thresholds:
 *   < 70% (or < warning)       -> "On Track"
 *   70–92% (warning–critical)   -> "Warning"
 *   92–100% (critical–exceeded) -> "Critical"
 *   >= 100% (exceeded)          -> "Over Budget"
 */
const budgetStatus = (usage, rules) => {
  const level = budgetAlertLevel(usage, rules);
  if (level === "exceeded" || usage >= 100) return OVER_BUDGET_LABEL;
  if (level === "critical") return CRITICAL_LABEL;
  if (level === "warning") return WARNING_LABEL;
  return ON_TRACK_LABEL;
};

/**
 * Core Part 9 budget-vs-actual computation, extracted so the Part 14 Alerts &
 * Insights Center reuses the exact same rows, thresholds and status helper
 * instead of duplicating them. `scope` is the caller's spendScope and
 * `filters` the cleaned query values ({ period, department, category }).
 * Period format validation stays in the HTTP wrapper (it answers 400 before
 * any query runs, exactly as before).
 *
 * Budget vs Actual: actual spend is read from the EXISTING Transaction
 * collection with one aggregation (no stored/duplicated actual values, no
 * second data source):
 *  - grouped by department + category + "YYYY-MM"
 *  - a budget with a category only counts that category
 *  - a budget without a category counts every category of that department
 */
const computeBudgetComparison = async (scope, filters = {}, rules = null) => {
  // P1-3: status labels use the workspace's effective alert rules. Callers that
  // already resolved them (Alerts Center) pass them in; otherwise they are
  // loaded here so the Budget page always reflects admin configuration.
  const effectiveRules = rules || (await AlertRule.findEffectiveRules(scope.organizationId));
  // Shared workspace budgets - identical for Admin and Viewer.
  const filter = { ...scope };
  const appliedFilters = { period: "", department: "", category: "" };

  const period = cleanText(filters.period);
  if (period) {
    filter.period = period;
    appliedFilters.period = period;
  }

  const department = cleanText(filters.department);
  if (department) {
    filter.department = exactFilter(department);
    appliedFilters.department = department;
  }

  const category = cleanText(filters.category);
  if (category) {
    filter.category = exactFilter(category);
    appliedFilters.category = category;
  }

  const budgets = await Budget.find(filter).sort({ period: -1, department: 1, category: 1 });

  // Dropdown options come from the workspace's budgets (unfiltered).
  const [departmentOptions, categoryOptions] = await Promise.all([
    Budget.distinct("department", scope),
    Budget.distinct("category", scope),
  ]);

  const facets = {
    departments: departmentOptions.filter(Boolean).sort(),
    categories: categoryOptions.filter(Boolean).sort(),
  };

  if (budgets.length === 0) {
    return {
      filters: appliedFilters,
      budgetCount: 0,
      totals: { totalBudget: 0, actualSpend: 0, remainingBudget: 0, usagePercentage: 0 },
      rows: [],
      facets,
    };
  }

  // One transaction query covering every period present in the result set.
  const periods = [...new Set(budgets.map((budget) => budget.period))];
  const windows = periods.map(monthWindow);

  const txMatch = {
    ...scope,
    $or: windows.map((window) => ({ date: { $gte: window.from, $lt: window.to } })),
  };
  if (appliedFilters.department) {
    txMatch.department = exactFilter(appliedFilters.department);
  }
  if (appliedFilters.category) {
    txMatch.category = exactFilter(appliedFilters.category);
  }

  const groups = await Transaction.aggregate([
    {
      $match: txMatch,
    },
    {
      $group: {
        _id: {
          department: "$department",
          category: "$category",
          period: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "UTC" } },
        },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  // Lookup tables, lower-cased so "technology" and "Technology" match.
  const byDepartmentCategoryPeriod = new Map();
  const byDepartmentPeriod = new Map();

  groups.forEach((group) => {
    const groupDepartment = group._id.department || "Unknown";
    const groupCategory = group._id.category || "";

    byDepartmentCategoryPeriod.set(
      `${groupDepartment}|${groupCategory}|${group._id.period}`.toLowerCase(),
      { total: Number(group.total), count: group.count }
    );

    const departmentKey = `${groupDepartment}|${group._id.period}`.toLowerCase();
    const current = byDepartmentPeriod.get(departmentKey) || { total: 0, count: 0 };
    current.total += Number(group.total);
    current.count += group.count;
    byDepartmentPeriod.set(departmentKey, current);
  });

  const rows = budgets.map((budget) => {
    const budgetAmount = round2(budget.amount);

    const matched = budget.category
      ? byDepartmentCategoryPeriod.get(
          `${budget.department}|${budget.category}|${budget.period}`.toLowerCase()
        )
      : byDepartmentPeriod.get(`${budget.department}|${budget.period}`.toLowerCase());

    const actualSpend = round2(matched ? matched.total : 0);
    // Never divide by zero (budget amounts are validated as > 0 anyway).
    const rawUsage = budgetAmount > 0 ? (actualSpend / budgetAmount) * 100 : 0;

    return {
      id: String(budget._id),
      department: budget.department,
      category: budget.category || "",
      period: budget.period,
      budget: budgetAmount,
      actual: actualSpend,
      remaining: round2(budgetAmount - actualSpend),
      variance: round2(actualSpend - budgetAmount),
      usagePercentage: round2(rawUsage),
      status: budgetStatus(rawUsage, effectiveRules),
      transactionCount: matched ? matched.count : 0,
    };
  });

  const sums = rows.reduce(
    (accumulator, row) => ({
      totalBudget: accumulator.totalBudget + row.budget,
    }),
    { totalBudget: 0 }
  );

  const totalBudget = round2(sums.totalBudget);
  const totalActual = round2(
    groups.reduce((accumulator, group) => accumulator + Number(group.total), 0)
  );

  return {
    filters: appliedFilters,
    budgetCount: rows.length,
    totals: {
      totalBudget,
      actualSpend: totalActual,
      remainingBudget: round2(totalBudget - totalActual),
      usagePercentage: totalBudget > 0 ? round2((totalActual / totalBudget) * 100) : 0,
    },
    rows,
    facets,
  };
};

/**
 * GET /api/budgets/comparison?period=YYYY-MM&department=&category=
 *
 * Thin HTTP wrapper: query validation + response shaping around the shared
 * computeBudgetComparison() helper (also reused by the Part 14 Alerts &
 * Insights Center). An invalid period answers 400 before any query runs.
 */
const getBudgetVsActual = async (req, res) => {
  try {
    const period = cleanText(req.query.period);
    if (period && !PERIOD_PATTERN.test(period)) {
      return res.status(400).json({ message: "Budget period must be a valid month (YYYY-MM)." });
    }

    const payload = await computeBudgetComparison(spendScope(req.user), {
      period,
      department: cleanText(req.query.department),
      category: cleanText(req.query.category),
    });

    return res.json(payload);
  } catch (error) {
    console.error("[budgets] Comparison failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

module.exports = {
  createBudget,
  getBudgets,
  getBudgetVsActual,
  computeBudgetComparison,
  budgetStatus,
  ON_TRACK_LABEL,
  WARNING_LABEL,
  CRITICAL_LABEL,
  UNDER_BUDGET_LABEL,
  NEAR_BUDGET_LABEL,
  OVER_BUDGET_LABEL,
  monthWindow,
  updateBudget,
  deleteBudget,
};

