// Alerts & Insights Center controller
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

const SECTION_KEYS = ["budget", "unusual", "spending", "activity"];
const SEVERITY_RANK = { critical: 0, warning: 1, insight: 2, info: 3 };

// Round to 1 decimal place
const roundPercent = (value) => Math.round(value * 10) / 10;

// Format date to YYYY-MM
const monthKeyOf = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 7);
};

// Format date to YYYY-MM-DD
const dayOf = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

// Budget alert titles.
const BUDGET_ALERT_TITLES = {
  exceeded: "Budget exceeded",
  critical: "Budget critical",
  warning: "Budget nearly exhausted",
};

// Build budget alerts
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

// Unusual spending alerts.
const buildUnusualAlerts = (unusual) =>
  unusual.unusualTransactions.map((tx) => {
    const date = new Date(tx.date);
    const vendor = tx.vendor || "Unknown vendor";
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

// Spending alerts.
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

  // Month-over-month trend
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

  // Top category / department / vendor
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

  // Category contributions
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

// Activity alerts.
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

// GET /api/insights
const getAlertsCenter = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const resolved = resolveInsightRange({});
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
        rules: { ...rules },
        budget: {
          budgetCount: budget.budgetCount,
          totals: budget.totals,
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
