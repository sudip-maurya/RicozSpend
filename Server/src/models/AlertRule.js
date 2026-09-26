const mongoose = require("mongoose");

const {
  DEFAULT_ALERT_RULES,
  ALERT_RULE_FIELDS,
  effectiveAlertRules,
} = require("../utils/alertRules");

/**
 * Admin-configurable alert rules (Part 15).
 *
 * ONE document per workspace (`organizationId` is unique), so every account in
 * the same workspace shares the same thresholds - exactly like transactions and
 * budgets. A workspace with no document simply uses DEFAULT_ALERT_RULES, so
 * nothing has to be seeded for the alerts to work.
 *
 * Field ranges + defaults come from utils/alertRules.js, which is also used by
 * the API validation and the Alert Rules editor, so schema and validation can never
 * disagree.
 */

const ruleFieldSchema = {};

ALERT_RULE_FIELDS.forEach(({ key, min, max }) => {
  ruleFieldSchema[key] = {
    type: Number,
    required: [true, "Alert rule values are required."],
    min: [min, `Value must be at least ${min}.`],
    max: [max, `Value must be at most ${max}.`],
    default: DEFAULT_ALERT_RULES[key],
  };
});

const alertRuleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: String,
      trim: true,
      required: true,
      unique: true,
      index: true,
    },
    ...ruleFieldSchema,
    /** Audit only: which Admin saved the current values. */
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret._id;
        return ret;
      },
    },
  }
);

/** Whitelisted representation: only the five rules, as plain numbers. */
alertRuleSchema.methods.toRuleObject = function toRuleObject() {
  return effectiveAlertRules(this);
};

/**
 * Effective rules for a workspace: the saved document merged over the defaults
 * (never null), so a missing/incomplete document can never break the alerts.
 */
alertRuleSchema.statics.findEffectiveRules = async function findEffectiveRules(organizationId) {
  const doc = await this.findOne({ organizationId });
  return effectiveAlertRules(doc);
};

const AlertRule = mongoose.models.AlertRule || mongoose.model("AlertRule", alertRuleSchema);

module.exports = AlertRule;
module.exports.DEFAULT_ALERT_RULES = DEFAULT_ALERT_RULES;
