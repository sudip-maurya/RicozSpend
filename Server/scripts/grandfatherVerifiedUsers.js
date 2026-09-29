// Grandfather legacy accounts created before email verification


const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

const run = async () => {
  await connectDB();

  const filter = { isEmailVerified: { $exists: false } };
  const accounts = await User.find(filter).select("email role createdAt");

  if (accounts.length === 0) {
    console.log("No pre-verification accounts found. Nothing to migrate.");
  } else {
    accounts.forEach((account) => {
      console.log(`  grandfathered: ${account.email} (${account.role}, created ${account.createdAt?.toISOString?.() ?? "unknown"})`);
    });

    const result = await User.updateMany(filter, { $set: { isEmailVerified: true } });
    console.log(`Marked ${result.modifiedCount} account(s) as email-verified.`);
  }

  console.log(`Database in use: ${mongoose.connection.db.databaseName}`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("Migration failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
