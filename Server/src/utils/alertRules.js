/**
 * Admin-configurable alert rules (Alerts Center -> Alert Rules editor).
 *
 * Every threshold the Alerts & Insights system uses comes from these five
 * percentage values, so an Admin can tune the rules from the Alert Rules editor
 * without touching code:
 *
 *  - budgetWarning    : budget usage % that raises the "nearing limit" warning
 *  - budgetCritical   : budget usage % that raises a critical alert
 *  - budgetExceeded   : budget usage % that counts as "budget exceeded"
 *  - unusualSpending  : % above the average transaction amount
 *  - spendingIncrease : % month-over-month rise that raises an alert
 *
 * DEFAULT_ALERT_RULES is used whenever a workspace has never saved its own
 * rules, so the feature works out of the box with zero stored state. The same
 * metadata drives the Mongoose schema, the API validation and the Alert Rules
 * editor, so the limits can never drift apart.
 *
 * This module is intentionally dependency-free (like utils/validation.js) so it
 * can be required from models, controllers and scripts alike.
 */

const DEFAULT_ALERT_RULES = {
  budgetWarning: 70,
  budgetCritical: 90,
  budgetExceeded: 100,
  unusualSpending: 50,
  spendingIncrease: 20,
};

/**
 * Field metadata (single source of truth): display order in the editor, the unit
 * label and the accepted numeric range used by both server validation and the
 * client form.
 */
const ALERT_RULE_FIELDS = [
  {
    key: "budgetWarning",
    label: "Budget Warning",
    unit: "%",
    description: "Budget usage that raises a warning alert.",
    min: 1,
    max: 100,
  },
  {
    key: "budgetCritical",
    label: "Budget Critical",
    unit: "%",
    description: "Budget usage that raises a critical alert.",
    min: 1,
    max: 100,
  },
  {
    key: "budgetExceeded",
    label: "Budget Exceeded",
    unit: "%",
    description: "Budget usage that counts as exceeded.",
    min: 1,
    max: 1000,
  },
  {
    key: "unusualSpending",
    label: "Unusual Spending",
    unit: "% above average",
    description: "How far above the average transaction amount is unusual.",
    min: 1,
    max: 1000,
  },
  {
    key: "spendingIncrease",
    label: "Spending Increase",
    unit: "%",
    description: "Month-over-month rise that raises an alert.",
    min: 1,
    max: 1000,
  },
];

const RULE_KEYS = ALERT_RULE_FIELDS.map((field) => field.key);

/** 42.34 -> 42.3 (one decimal is enough for a percentage threshold). */
const round1 = (value) => Math.round(value * 10) / 10;

/** Accepts a real number or a numeric string; anything else is NaN. */
const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
};

/**
 * Validate an Alert Rules payload.
 * @returns {{ isValid: boolean, errors: Record<string,string>, values: Record<string,number> }}
 */
const validateAlertRules = (payload = {}) => {
  const errors = {};
  const values = {};
  const source = payload && typeof payload === "object" ? payload : {};

  ALERT_RULE_FIELDS.forEach(({ key, label, min, max }) => {
    const raw = source[key];

    if (raw === undefined || raw === null || raw === "") {
      errors[key] = `${label} is required.`;
      return;
    }

    const value = toNumber(raw);

    if (!Number.isFinite(value)) {
      errors[key] = `${label} must be a number.`;
      return;
    }

    if (value < min || value > max) {
      errors[key] = `${label} must be between ${min} and ${max}.`;
      return;
    }

    values[key] = round1(value);
  });

  // Ordering: warning < critical <= exceeded (checked as soon as all three parsed).
  const { budgetWarning: warning, budgetCritical: critical, budgetExceeded: exceeded } = values;

  if (Number.isFinite(warning) && Number.isFinite(critical) && critical <= warning) {
    errors.budgetCritical = "Budget Critical must be greater than Budget Warning.";
  }

  if (Number.isFinite(critical) && Number.isFinite(exceeded) && exceeded < critical) {
    errors.budgetExceeded = "Budget Exceeded must be greater than or equal to Budget Critical.";
  }

  return { isValid: Object.keys(errors).length === 0, errors, values };
};

/**
 * Merge a stored document (or null) over the defaults: every returned field is
 * always a finite number, so callers never have to guard against missing data.
 */
const effectiveAlertRules = (doc) => {
  if (!doc) return { ...DEFAULT_ALERT_RULES };

  return RULE_KEYS.reduce((accumulator, key) => {
    const value = Number(doc[key]);
    return { ...accumulator, [key]: Number.isFinite(value) ? value : DEFAULT_ALERT_RULES[key] };
  }, {});
};

/** "50% above average" -> 1.5 (multiplier applied to the average transaction). */
const unusualMultiplierFor = (rules) => {
  const percent = Number(effectiveAlertRules(rules).unusualSpending);
  return Number((1 + percent / 100).toFixed(4));
};

/** Budget alert tier for a usage percentage: "exceeded" | "critical" | "warning" | null. */
const budgetAlertLevel = (usagePercentage, rules) => {
  const effective = effectiveAlertRules(rules);

  if (!Number.isFinite(usagePercentage)) return null;
  if (usagePercentage >= effective.budgetExceeded) return "exceeded";
  if (usagePercentage >= effective.budgetCritical) return "critical";
  if (usagePercentage >= effective.budgetWarning) return "warning";
  return null;
};

module.exports = {
  DEFAULT_ALERT_RULES,
  ALERT_RULE_FIELDS,
  RULE_KEYS,
  validateAlertRules,
  effectiveAlertRules,
  unusualMultiplierFor,
  budgetAlertLevel,
};
