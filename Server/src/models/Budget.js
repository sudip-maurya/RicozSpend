const mongoose = require("mongoose");

/** Budget model for planned spend. */
const budgetSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: String,
      trim: true,
      default: "ricozspend-default",
      index: true,
    },
    department: {
      type: String,
      required: [true, "Cost centre / department is required."],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "",
    },
    amount: {
      type: Number,
      required: [true, "Budget amount is required."],
      validate: {
        validator: (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
        message: "Budget amount must be a number greater than 0.",
      },
    },
    // Stored as "YYYY-MM"
    period: {
      type: String,
      required: [true, "Budget period is required."],
      trim: true,
      validate: {
        validator: (value) =>
          typeof value === "string" && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(value.trim()),
        message: "Budget period must be a valid month (YYYY-MM).",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.user;
        return ret;
      },
    },
  }
);

// Unique compound index
budgetSchema.index(
  { organizationId: 1, department: 1, category: 1, period: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);
budgetSchema.index({ user: 1, period: 1 });
budgetSchema.index({ organizationId: 1, period: 1 });

module.exports = mongoose.models.Budget || mongoose.model("Budget", budgetSchema);
