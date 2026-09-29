const mongoose = require("mongoose");

const {
  DEFAULT_ALERT_RULES,
  ALERT_RULE_FIELDS,
  effectiveAlertRules,
} = require("../utils/alertRules");

/** Configurable alert rules schema. */

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
    // Audit reference to admin user
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

/** Plain object representation of alert rules. */
alertRuleSchema.methods.toRuleObject = function toRuleObject() {
  return effectiveAlertRules(this);
};

/** Find effective rules or default rules for workspace. */
alertRuleSchema.statics.findEffectiveRules = async function findEffectiveRules(organizationId) {
  const doc = await this.findOne({ organizationId });
  return effectiveAlertRules(doc);
};

const AlertRule = mongoose.models.AlertRule || mongoose.model("AlertRule", alertRuleSchema);

module.exports = AlertRule;
module.exports.DEFAULT_ALERT_RULES = DEFAULT_ALERT_RULES;
