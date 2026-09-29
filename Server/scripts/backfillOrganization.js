// Backfill organizationId on legacy documents


const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");

const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Transaction = require("../src/models/Transaction");
const Budget = require("../src/models/Budget");
const { DEFAULT_ORGANIZATION_ID } = require("../src/utils/spendScope");

const main = async () => {
  await connectDB();

  console.log("RicozSpend workspace backfill (development / testing)");
  console.log(`Workspace: ${DEFAULT_ORGANIZATION_ID}`);

  const users = await User.updateMany(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: "" }] },
    { $set: { organizationId: DEFAULT_ORGANIZATION_ID } }
  );
  console.log(`Users updated: ${users.modifiedCount}`);

  const transactions = await Transaction.updateMany(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: "" }] },
    { $set: { organizationId: DEFAULT_ORGANIZATION_ID } }
  );
  console.log(`Transactions updated: ${transactions.modifiedCount}`);

  const budgets = await Budget.updateMany(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: "" }] },
    { $set: { organizationId: DEFAULT_ORGANIZATION_ID } }
  );
  console.log(`Budgets updated: ${budgets.modifiedCount}`);

  console.log(
    `Remaining documents without a workspace: ` +
      `${await User.countDocuments({ $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: "" }] })} users, ` +
      `${await Transaction.countDocuments({ $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: "" }] })} transactions, ` +
      `${await Budget.countDocuments({ $or: [{ organizationId: { $exists: false } }, { organizationId: null }, { organizationId: "" }] })} budgets`
  );

  await mongoose.connection.close();
};

main().catch(async (error) => {
  console.error("Backfill failed:", error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
