/** Alert rules configuration, defaults, and validation. */

const DEFAULT_ALERT_RULES = {
  budgetWarning: 70,
  budgetCritical: 90,
  budgetExceeded: 100,
  unusualSpending: 50,
  spendingIncrease: 20,
};

/** Alert rule field definitions and constraints. */
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

const round1 = (value) => Math.round(value * 10) / 10;

const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
};

/** Validate alert rules payload. */
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

  // Validate threshold ordering: warning < critical <= exceeded
  const { budgetWarning: warning, budgetCritical: critical, budgetExceeded: exceeded } = values;

  if (Number.isFinite(warning) && Number.isFinite(critical) && critical <= warning) {
    errors.budgetCritical = "Budget Critical must be greater than Budget Warning.";
  }

  if (Number.isFinite(critical) && Number.isFinite(exceeded) && exceeded < critical) {
    errors.budgetExceeded = "Budget Exceeded must be greater than or equal to Budget Critical.";
  }

  return { isValid: Object.keys(errors).length === 0, errors, values };
};

/** Merge stored rules with defaults. */
const effectiveAlertRules = (doc) => {
  if (!doc) return { ...DEFAULT_ALERT_RULES };

  return RULE_KEYS.reduce((accumulator, key) => {
    const value = Number(doc[key]);
    return { ...accumulator, [key]: Number.isFinite(value) ? value : DEFAULT_ALERT_RULES[key] };
  }, {});
};

/** Calculate multiplier from unusual spending percentage. */
const unusualMultiplierFor = (rules) => {
  const percent = Number(effectiveAlertRules(rules).unusualSpending);
  return Number((1 + percent / 100).toFixed(4));
};

/** Determine alert tier from budget usage percentage. */
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
