/**
 * Alerts & Insights Center controller (Part 14).
 *
 * One read-only endpoint that gathers every deterministic alert the app can
 * already derive from existing data - no AI, no new collections, no stored
 * state, no fake numbers. Everything is recomputed on demand by reusing the
 * exact same helpers the individual endpoints use (reuse-first, nothing is
 * duplicated here):
 *
 *  - computeBudgetComparison() -> budget rows + usage percentages (Part 9)
 *  - computeUnusualSpending()  -> transactions above the configured threshold (Part 7)
 *  - computeSpendInsights()    -> month trend, top category/department/vendor,
 *                                 contributions, activity (Part 8)
 *  - resolveInsightRange({})   -> the neutral "no filters" analysis window
 *
 * Part 15: every threshold comes from the Admin-configurable Alert Rules
 * (Alerts Center -> Alert Rules editor, stored per workspace in the AlertRule collection).
 * A workspace without saved rules uses DEFAULT_ALERT_RULES, so nothing has to
 * be configured for alerts to work:
 *
 *  - budgetWarning    (default 70)  -> warning  "Budget nearly exhausted"
 *  - budgetCritical   (default 90)  -> critical "Budget critical"
 *  - budgetExceeded   (default 100) -> critical "Budget exceeded"
 *  - unusualSpending  (default 50)  -> warning  "Unusual spending" (50% above average)
 *  - spendingIncrease (default 20)  -> warning  "Spending increased" (>= 20% MoM)
 *
 * severity rules (deterministic, documented for verification):
 *  - critical : budget usage >= the critical (or exceeded) rule
 *  - warning  : budget usage >= the warning rule, unusual transactions,
 *               month-over-month increase at or above the configured percentage
 *  - insight  : month-over-month decrease, top category/department/vendor,
 *               category contribution split
 *  - info     : activity snapshot, increase below the alert level + honest
 *               empty-state notices
 *
 * Sections group alerts by topic (budget / unusual / spending / activity);
 * severity is an independent axis the UI can filter on. Money values travel
 * as raw numbers in `amount`/`meta` (the client formats currency); `message`
 * text only ever contains currency-free facts (percentages, counts, names,
 * dates). The effective rules are published read-only in `meta.rules` so the
 * page can label its sections with the live thresholds.
 *
 * GET /api/insights - `protect` only, same as analytics: Admin and Viewer
 * both read the shared workspace dataset through spendScope.
 */

const {
  computeSpendInsights,
  computeUnusualSpending,
  resolveInsightRange,
} = require("./analyticsController");
const { computeBudgetComparison } = require("./budgetController");
const AlertRule = require("../models/AlertRule");
const {
  budgetAlertLevel,
  unusualMultiplierFor,
} = require("../utils/alertRules");
const { spendScope } = require("../utils/spendScope");

const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";

/** Section order as rendered by the Alerts & Insights Center page. */
const SECTION_KEYS = ["budget", "unusual", "spending", "activity"];
/** Deterministic ordering inside a section (independent of data order). */
const SEVERITY_RANK = { critical: 0, warning: 1, insight: 2, info: 3 };

/** 42.3456 -> 42.3 (same one-decimal rule the Part 8 payload uses). */
const roundPercent = (value) => Math.round(value * 10) / 10;

/** Date/ISO string -> "YYYY-MM" (same shape as budget periods). */
const monthKeyOf = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 7);
};

/** Date/ISO string -> "YYYY-MM-DD" for message text. */
const dayOf = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

/* ------------------------------------------------------------ section: budget */

/** Titles per configured tier (Part 15 rules decide which tier applies). */
const BUDGET_ALERT_TITLES = {
  exceeded: "Budget exceeded",
  critical: "Budget critical",
  warning: "Budget nearly exhausted",
};

/**
 * Budget alerts from the Part 9 rows. The tier comes from the row's raw
 * `usagePercentage` (never duplicated) judged against the Admin-configured
 * rules, so changing Budget Warning / Critical / Exceeded in the Alert Rules editor
 * immediately changes which budgets raise an alert - and how severe it is.
 * The descriptive Part 9 `status` label keeps its own meaning and travels
 * along in `meta` unchanged.
 */
const buildBudgetAlerts = (budget, rules) => {
  const alerts = [];

  budget.rows.forEach((row) => {
    const level = budgetAlertLevel(row.usagePercentage, rules);
    if (!level) return;

    const scopeLabel = [row.department, row.category].filter(Boolean).join(" / ");
    const scopeText = `the planned ${row.period} budget for ${scopeLabel}`;
    const usageText = `Actual spend reached ${row.usagePercentage}% of`;

    const message =
      level === "warning"
        ? `${usageText} ${scopeText} - near the ${rules.budgetWarning}% warning level.`
        : level === "critical"
          ? `${usageText} ${scopeText} - at or above the ${rules.budgetCritical}% critical level.`
          : `${usageText} ${scopeText}.`;

    alerts.push({
      id: `budget-${row.id}`,
      section: "budget",
      severity: level === "warning" ? "warning" : "critical",
      title: BUDGET_ALERT_TITLES[level],
      message,
      amount: row.actual,
      periodKey: row.period,
      timestamp: null,
      meta: {
        department: row.department,
        category: row.category,
        period: row.period,
        budget: row.budget,
        actual: row.actual,
        remaining: row.remaining,
        variance: row.variance,
        usagePercentage: row.usagePercentage,
        alertLevel: level,
        status: row.status,
        transactionCount: row.transactionCount,
      },
    });
  });

  return alerts.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      b.meta.usagePercentage - a.meta.usagePercentage
  );
};

/* ---------------------------------------------------------- section: unusual */

/**
 * One warning per transaction above the Part 7 threshold (average x the
 * Admin-configured "Unusual Spending" multiplier, default 1.5 = 50% above
 * average). The helper already sorts them by amount descending - order is
 * preserved.
 */
const buildUnusualAlerts = (unusual) =>
  unusual.unusualTransactions.map((tx) => {
    const date = new Date(tx.date);
    const vendor = tx.vendor || "Unknown vendor";
    // Transaction.toJSON() renames `_id` to `id`, so `tx.id` is the real key
    // (the deterministic fallback only guards against an unexpected shape, so
    // two different transactions can never end up sharing one alert id).
    const transactionId = tx.id || `${dayOf(date)}-${vendor}-${tx.amount}`;

    return {
      id: `unusual-${transactionId}`,
      section: "unusual",
      severity: "warning",
      title: "Unusual spending",
      message: `The ${dayOf(date)} transaction from ${vendor} is more than ${unusual.multiplier}x the average transaction amount.`,
      amount: tx.amount,
      periodKey: monthKeyOf(date),
      timestamp: date.toISOString(),
      meta: {
        date: dayOf(date),
        vendor,
        category: tx.category || "",
        department: tx.department || "",
        amount: tx.amount,
        threshold: unusual.threshold,
        multiplier: unusual.multiplier,
        percentAboveAverage: unusual.percentAboveAverage,
        averageTransaction: unusual.averageTransaction,
        differenceFromAverage: tx.differenceFromAverage,
        reason: tx.reason,
      },
    };
  });

/* ---------------------------------------------------------- section: spending */

/**
 * Insights from the Part 8 payload: month trend + factual top/contribution
 * cards. An increase is an alert only when it reaches the Admin-configured
 * "Spending Increase" percentage; a smaller rise is reported as an info card
 * that names the live threshold, so nothing is hidden and nothing is invented.
 */
const buildSpendingAlerts = (spend) => {
  const alerts = [];
  const {
    monthComparison,
    topCategory,
    topDepartment,
    topVendor,
    categoryContributions,
    transactionActivity,
  } = spend;
  const totalSpend = transactionActivity.totalSpend;

  const shareOf = (amount) => (totalSpend > 0 ? roundPercent((amount / totalSpend) * 100) : 0);

  /* --- month-over-month trend ------------------------------------------- */
  if (monthComparison.currentMonth) {
    const trend = {
      id: "spending-month-trend",
      section: "spending",
      amount: monthComparison.currentSpend,
      periodKey: null,
      timestamp: null,
      meta: { ...monthComparison },
    };

    const { direction, changePercentage, currentMonth, previousMonth } = monthComparison;

    if (direction === "increase") {
      const threshold = monthComparison.alertThresholdPercentage;

      alerts.push({
        ...trend,
        severity: monthComparison.crossesAlertThreshold ? "warning" : "info",
        title: monthComparison.crossesAlertThreshold
          ? "Spending increased"
          : "Spending increase below alert level",
        message: monthComparison.crossesAlertThreshold
          ? `Spending in ${currentMonth} is ${changePercentage}% higher than in ${previousMonth}.`
          : `Spending in ${currentMonth} is ${changePercentage}% higher than in ${previousMonth}, below the ${threshold}% alert level.`,
      });
    } else if (direction === "decrease") {
      alerts.push({
        ...trend,
        severity: "insight",
        title: "Spending decreased",
        message: `Spending in ${currentMonth} is ${Math.abs(changePercentage)}% lower than in ${previousMonth}.`,
      });
    } else if (direction === "no_change") {
      alerts.push({
        ...trend,
        severity: "info",
        title: "Spending unchanged",
        message: `Spending in ${currentMonth} is unchanged from ${previousMonth}.`,
      });
    } else {
      alerts.push({
        ...trend,
        severity: "info",
        title: "No previous month to compare",
        message: `No spending was recorded in ${previousMonth}, so ${currentMonth} cannot be compared month over month.`,
      });
    }
  }

  /* --- top category / department / vendor -------------------------------- */
  if (topCategory) {
    alerts.push({
      id: "spending-top-category",
      section: "spending",
      severity: "insight",
      title: "Top spending category",
      message: `${topCategory.name} leads with ${shareOf(topCategory.total)}% of total spend across ${topCategory.count} transactions.`,
      amount: topCategory.total,
      periodKey: null,
      timestamp: null,
      meta: {
        name: topCategory.name,
        count: topCategory.count,
        share: shareOf(topCategory.total),
        totalSpend,
      },
    });
  }

  if (topDepartment) {
    alerts.push({
      id: "spending-top-department",
      section: "spending",
      severity: "insight",
      title: "Top spending department",
      message: `${topDepartment.name} is the highest-spending department with ${shareOf(topDepartment.total)}% of total spend (${topDepartment.count} transactions).`,
      amount: topDepartment.total,
      periodKey: null,
      timestamp: null,
      meta: {
        name: topDepartment.name,
        count: topDepartment.count,
        share: shareOf(topDepartment.total),
        totalSpend,
      },
    });
  }

  if (topVendor) {
    alerts.push({
      id: "spending-top-vendor",
      section: "spending",
      severity: "insight",
      title: "Top vendor by spend",
      message: `${topVendor.name} is the biggest vendor with ${shareOf(topVendor.total)}% of total spend (${topVendor.count} transactions).`,
      amount: topVendor.total,
      periodKey: null,
      timestamp: null,
      meta: {
        name: topVendor.name,
        count: topVendor.count,
        share: shareOf(topVendor.total),
        totalSpend,
      },
    });
  }

  /* --- category contribution split --------------------------------------- */
  if (categoryContributions.length > 0) {
    const split = categoryContributions
      .map((entry) => `${entry.name} ${entry.share}%`)
      .join(" | ");

    alerts.push({
      id: "spending-category-contribution",
      section: "spending",
      severity: "insight",
      title: "Category contribution",
      message: `Share of total spend: ${split}.`,
      amount: null,
      periodKey: null,
      timestamp: null,
      meta: { contributions: categoryContributions, totalSpend },
    });
  }

  return alerts;
};

/* ----------------------------------------------------------- section: activity */

/**
 * Honest state notices: what the analysis window contains, plus empty-state
 * guidance when there is nothing to alert on yet. Facts only - never invented
 * data. The "healthy budgets" notice names the live (Admin-configured) warning
 * level.
 */
const buildActivityAlerts = (spend, budget, unusual, budgetAlertCount, rules) => {
  const activity = [];
  const { transactionActivity } = spend;

  if (transactionActivity.count === 0) {
    activity.push({
      id: "activity-no-transactions",
      section: "activity",
      severity: "info",
      title: "No transactions yet",
      message: "There are no transactions to analyse yet, so no spending alerts can be calculated.",
      amount: null,
      periodKey: null,
      timestamp: null,
      meta: { transactionCount: 0 },
    });
  } else {
    activity.push({
      id: "activity-snapshot",
      section: "activity",
      severity: "info",
      title: "Transaction activity",
      message: `${transactionActivity.count} transactions recorded in the analysis window.`,
      amount: transactionActivity.totalSpend,
      periodKey: null,
      timestamp: null,
      meta: {
        count: transactionActivity.count,
        totalSpend: transactionActivity.totalSpend,
        averageTransaction: transactionActivity.averageTransaction,
      },
    });

    if (unusual.unusualCount === 0) {
      activity.push({
        id: "activity-no-unusual",
        section: "activity",
        severity: "info",
        title: "No unusual spending",
        message: `No transaction exceeds the alert rule (more than ${unusual.multiplier}x the average transaction amount).`,
        amount: null,
        periodKey: null,
        timestamp: null,
        meta: { threshold: unusual.threshold, averageTransaction: unusual.averageTransaction },
      });
    }
  }

  if (budget.budgetCount === 0) {
    activity.push({
      id: "activity-no-budgets",
      section: "activity",
      severity: "info",
      title: "No budgets configured",
      message: "No budgets exist yet, so budget usage alerts are unavailable.",
      amount: null,
      periodKey: null,
      timestamp: null,
      meta: { budgetCount: 0 },
    });
  } else if (budgetAlertCount === 0) {
    activity.push({
      id: "activity-budgets-healthy",
      section: "activity",
      severity: "info",
      title: "All budgets healthy",
      message: `All ${budget.budgetCount} budgets are below the ${rules.budgetWarning}% warning level.`,
      amount: budget.totals.totalBudget,
      periodKey: null,
      timestamp: null,
      meta: {
        budgetCount: budget.budgetCount,
        totals: budget.totals,
        warningLevel: rules.budgetWarning,
      },
    });
  }

  return activity;
};

/* --------------------------------------------------------------- main handler */

/**
 * GET /api/insights
 *
 * Resolves the workspace's Admin-configured rules once, then runs the three
 * shared computations with them and assembles the four alert sections +
 * summary counts + period facet (for the page's filters). `periods` only
 * contains periods that actually appear on alerts; alerts with periodKey null
 * are "overall" facts (insights/activity) that always apply.
 */
const getAlertsCenter = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    // Neutral window: no from/to, no preset, no category/department/vendor
    // filter - the centre shows the whole workspace picture by default.
    const resolved = resolveInsightRange({});

    // Part 15: one rules lookup per request drives every threshold below.
    const rules = await AlertRule.findEffectiveRules(scope.organizationId);

    const [budget, unusual, spend] = await Promise.all([
      computeBudgetComparison(scope, {}, rules),
      computeUnusualSpending(scope, { multiplier: unusualMultiplierFor(rules) }),
      computeSpendInsights(scope, resolved, {}, {
        increaseAlertThreshold: rules.spendingIncrease,
      }),
    ]);

    const budgetAlerts = buildBudgetAlerts(budget, rules);
    const unusualAlerts = buildUnusualAlerts(unusual);
    const spendingAlerts = buildSpendingAlerts(spend);
    const activityAlerts = buildActivityAlerts(spend, budget, unusual, budgetAlerts.length, rules);

    const sections = {
      budget: budgetAlerts,
      unusual: unusualAlerts,
      spending: spendingAlerts,
      activity: activityAlerts,
    };

    const all = SECTION_KEYS.flatMap((key) => sections[key]);

    const countBy = (severity) => all.filter((alert) => alert.severity === severity).length;
    const summary = {
      total: all.length,
      critical: countBy("critical"),
      warning: countBy("warning"),
      insight: countBy("insight"),
      info: countBy("info"),
      sections: SECTION_KEYS.reduce(
        (accumulator, key) => ({ ...accumulator, [key]: sections[key].length }),
        {}
      ),
    };

    const periods = [...new Set(all.map((alert) => alert.periodKey).filter(Boolean))]
      .sort()
      .reverse();

    return res.json({
      generatedAt: new Date().toISOString(),
      summary,
      periods,
      sections,
      meta: {
        // Part 15: the effective (saved or default) rules behind every alert,
        // published read-only so the UI can name the live thresholds.
        rules: { ...rules },
        budget: {
          budgetCount: budget.budgetCount,
          totals: budget.totals,
          // Critical-severity budget alerts (exceeded rule + critical rule).
          overBudget: budgetAlerts.filter((alert) => alert.severity === "critical").length,
          nearBudget: budgetAlerts.filter((alert) => alert.severity === "warning").length,
          exceeded: budgetAlerts.filter((alert) => alert.meta.alertLevel === "exceeded").length,
          critical: budgetAlerts.filter((alert) => alert.meta.alertLevel === "critical").length,
          thresholds: {
            warning: rules.budgetWarning,
            critical: rules.budgetCritical,
            exceeded: rules.budgetExceeded,
          },
        },
        unusual: {
          transactionCount: unusual.transactionCount,
          averageTransaction: unusual.averageTransaction,
          threshold: unusual.threshold,
          unusualCount: unusual.unusualCount,
          multiplier: unusual.multiplier,
          percentAboveAverage: unusual.percentAboveAverage,
        },
        insights: {
          transactionCount: spend.transactionActivity.count,
          totalSpend: spend.transactionActivity.totalSpend,
          direction: spend.monthComparison.direction,
          increaseAlertThreshold: spend.monthComparison.alertThresholdPercentage,
          crossesAlertThreshold: spend.monthComparison.crossesAlertThreshold,
          topCategory: spend.topCategory ? spend.topCategory.name : null,
          topDepartment: spend.topDepartment ? spend.topDepartment.name : null,
          topVendor: spend.topVendor ? spend.topVendor.name : null,
        },
      },
    });
  } catch (error) {
    console.error("[insights] Alerts center failed:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

module.exports = { getAlertsCenter };
