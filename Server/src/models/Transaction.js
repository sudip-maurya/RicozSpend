const mongoose = require("mongoose");

/**
 * Transaction / spend entry model (Part 3 - dashboard data source).
 *
 * DATA OWNERSHIP = WORKSPACE: `organizationId` decides who can see the record
 * (every account in the same workspace sees the same dataset). `user` records
 * who created it for audit/history and is never used to hide shared data.
 */
const transactionSchema = new mongoose.Schema(
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
    date: {
      type: Date,
      required: [true, "Transaction date is required."],
      index: true,
    },
    vendor: {
      type: String,
      required: [true, "Vendor is required."],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required."],
      trim: true,
    },
    department: {
      type: String,
      required: [true, "Cost centre / department is required."],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required."],
      validate: {
        validator: (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
        message: "Amount must be a number greater than 0.",
      },
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.user; // never expose which account owns the record
        return ret;
      },
    },
  }
);

// Aggregation helpers all match on user + date, so cover the compound index.
transactionSchema.index({ user: 1, date: -1 });
// P1-6: the dashboard/analytics/budget aggregations always filter by
// organizationId and group/sort by date - this is the hot query path.
transactionSchema.index({ organizationId: 1, date: -1 });

module.exports = mongoose.model("Transaction", transactionSchema);