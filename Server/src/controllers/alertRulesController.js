/** Alert rules configuration controller. */

const AlertRule = require("../models/AlertRule");
const {
  ALERT_RULE_FIELDS,
  DEFAULT_ALERT_RULES,
  effectiveAlertRules,
  validateAlertRules,
} = require("../utils/alertRules");
const { spendScope } = require("../utils/spendScope");

const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";
const VALIDATION_MESSAGE = "Please correct the highlighted alert rules.";

/** Format alert rules response payload. */
const shapeAlertRules = (doc) => ({
  rules: effectiveAlertRules(doc),
  defaults: { ...DEFAULT_ALERT_RULES },
  fields: ALERT_RULE_FIELDS,
  isCustom: Boolean(doc),
  updatedAt: doc?.updatedAt || null,
  updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
});

/** GET /api/alert-rules */
const getAlertRules = async (req, res) => {
  try {
    const doc = await AlertRule.findOne(spendScope(req.user));
    return res.json(shapeAlertRules(doc));
  } catch (error) {
    console.error("[alert-rules] Failed to load rules:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/** PUT /api/alert-rules */
const updateAlertRules = async (req, res) => {
  try {
    const { isValid, errors, values } = validateAlertRules(req.body);

    if (!isValid) {
      return res.status(400).json({ message: VALIDATION_MESSAGE, errors });
    }

    const scope = spendScope(req.user);

    const doc = await AlertRule.findOneAndUpdate(
      scope,
      { $set: { ...values, ...scope, updatedBy: req.user._id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.json({ message: "Alert rules saved.", ...shapeAlertRules(doc) });
  } catch (error) {
    console.error("[alert-rules] Failed to save rules:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

module.exports = { getAlertRules, updateAlertRules };
