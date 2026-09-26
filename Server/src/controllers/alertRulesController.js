/**
 * Alert Rules controller (Alerts Center -> Alert Rules editor).
 *
 * Every handler runs behind `protect + requireRole("Admin")`
 * (see src/routes/alertRulesRoutes.js), so a Viewer token answers 403 before a
 * controller is ever reached. The workspace is always taken from the
 * authenticated account (`spendScope(req.user)`) - never from the request body.
 *
 * GET  /api/alert-rules -> the effective rules (saved values or defaults)
 * PUT  /api/alert-rules -> validated save (upsert) of the five percentages
 */

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

/**
 * One consistent response shape for GET and PUT: the effective values, the
 * defaults (for the "restore defaults" action), the field metadata (labels,
 * units, ranges) and whether this workspace has saved its own rules.
 */
const shapeAlertRules = (doc) => ({
  rules: effectiveAlertRules(doc),
  defaults: { ...DEFAULT_ALERT_RULES },
  fields: ALERT_RULE_FIELDS,
  isCustom: Boolean(doc),
  updatedAt: doc?.updatedAt || null,
  updatedBy: doc?.updatedBy ? String(doc.updatedBy) : null,
});

/** GET /api/alert-rules (Admin only) */
const getAlertRules = async (req, res) => {
  try {
    const doc = await AlertRule.findOne(spendScope(req.user));
    return res.json(shapeAlertRules(doc));
  } catch (error) {
    console.error("[alert-rules] Failed to load rules:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/** PUT /api/alert-rules (Admin only) - validated upsert of the five percentages. */
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
