/**
 * Create (or promote) an Admin user in the existing MongoDB Atlas database.
 *
 * Public signup can only ever create Viewers, so the very first Admin has to be
 * seeded from the server side.
 *
 * Usage (from the Server/ folder):
 *   npm run create-admin -- "Sudip Maurya" admin@example.com "YourPassword123"
 *   (or set ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD in Server/.env)
 *
 * No password is ever printed by this script.
 */

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const { PASSWORD_MIN_LENGTH, normalizeEmail, normalizeName } = require("../src/utils/validation");

const { ROLES } = User;

const run = async () => {
  const [nameArg, emailArg, passwordArg] = process.argv.slice(2);

  const name = normalizeName(nameArg || process.env.ADMIN_NAME);
  const email = normalizeEmail(emailArg || process.env.ADMIN_EMAIL);
  const password = passwordArg || process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.error(
      'Missing arguments. Usage: npm run create-admin -- "Full Name" admin@example.com "Password123"'
    );
    process.exit(1);
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    console.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
    process.exit(1);
  }

  await connectDB();

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    if (existingUser.role === ROLES.ADMIN && existingUser.isEmailVerified) {
      console.log(`User ${email} is already a verified Admin. Nothing to do.`);
    } else {
      existingUser.role = ROLES.ADMIN;
      // Seeded by an operator, so there is no signup email to verify.
      existingUser.isEmailVerified = true;
      await existingUser.save();
      console.log(`Promoted existing user ${email} to Admin (email marked verified).`);
    }
  } else {
    const admin = await User.create({
      name,
      email,
      password,
      role: ROLES.ADMIN,
      isEmailVerified: true,
    });
    console.log(`Created Admin user ${admin.email} (id: ${admin.id}).`);
  }

  console.log(`Database in use: ${mongoose.connection.db.databaseName}`);
  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (error) => {
  console.error("Failed to create Admin user:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
