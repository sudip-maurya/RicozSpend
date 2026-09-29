// Development sample data seeder

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoose = require("mongoose");

const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Transaction = require("../src/models/Transaction");
const Budget = require("../src/models/Budget");
const { signToken } = require("../src/utils/token");
const { DEFAULT_ORGANIZATION_ID } = require("../src/utils/spendScope");

const { ROLES } = User;

const SAMPLE_MARKER = "[sample]";
const SAMPLE_PATTERN = new RegExp(`^\\${SAMPLE_MARKER}`);
const PORT = Number(process.env.SEED_PORT || 5094);

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const argValue = (name) => {
  const hit = args.find((entry) => entry.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
};

const CLEAN_ONLY = hasFlag("clean");
const FORCE = hasFlag("force");
const TARGET_EMAIL = argValue("email") || process.env.SEED_EMAIL || "admin@example.com";

// Dates
const today = new Date();

// Current UTC month minus offset
const monthKey = (offset) => {
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const isoDate = (month, day) => `${month}-${String(day).padStart(2, "0")}`;

const BUDGET_PERIOD = monthKey(0);

// Sample transactions: [monthOffset, day, vendor, category, department, amount, description]
const SAMPLE_TRANSACTIONS = [
  // Current month
  [0, 3, "Dell Technologies", "IT", "IT", 450000, "Laptop rollout - 40 units"],
  [0, 7, "Microsoft", "IT", "IT", 85000, "Microsoft 365 annual licences"],
  [0, 9, "AWS", "IT", "IT", 65000, "Cloud hosting and storage"],
  [0, 12, "Adobe", "IT", "IT", 32000, "Creative Cloud seats"],
  [0, 15, "Zoom", "IT", "IT", 9500, "Video conferencing licences"],
  [0, 18, "Dell Technologies", "IT", "IT", 12999, "Docking stations and keyboards"],
  [0, 4, "Google Ads", "Marketing", "Marketing", 120000, "Paid search campaign"],
  [0, 8, "Meta Ads", "Marketing", "Marketing", 90000, "Social media campaign"],
  [0, 14, "Mailchimp", "Marketing", "Marketing", 25000, "Email marketing platform"],
  [0, 20, "Canva", "Marketing", "Marketing", 15000, "Design tool seats"],
  [0, 5, "Staples", "Office Supplies", "Operations", 45000, "Office furniture"],
  [0, 11, "Amazon Business", "Office Supplies", "Operations", 60000, "Consumables restock"],
  [0, 17, "WeWork", "Operations", "Operations", 35500, "Coworking desks"],
  [0, 22, "Swiggy", "Operations", "Operations", 9500, "Team meals"],
  [0, 6, "Randstad", "Operations", "HR", 70000, "Recruitment services"],
  [0, 13, "Naukri.com", "Operations", "HR", 30000, "Job postings"],
  [0, 19, "Zoho People", "IT", "HR", 20000, "HR software"],
  [0, 10, "Tata Power", "Utilities", "Finance", 18000, "Electricity"],
  [0, 16, "Reliance Jio", "Utilities", "Finance", 6500, "Connectivity"],
  [0, 21, "IndiGo", "Travel", "Sales", 30000, "Client visit flights"],
  // Previous months
  [1, 8, "Dell Technologies", "IT", "IT", 220000, "Server refresh"],
  [1, 12, "Microsoft", "IT", "IT", 45000, "Licence renewal"],
  [1, 15, "Staples", "Office Supplies", "Operations", 22000, "Printer supplies"],
  [1, 18, "Randstad", "Operations", "HR", 40000, "Recruitment services"],
  [1, 20, "IndiGo", "Travel", "Sales", 18000, "Conference travel"],
  [1, 24, "Tata Power", "Utilities", "Finance", 15000, "Electricity"],
  [2, 5, "AWS", "IT", "IT", 38000, "Cloud hosting and storage"],
  [2, 9, "Adobe", "IT", "IT", 21000, "Creative Cloud seats"],
  [2, 13, "Google Ads", "Marketing", "Marketing", 55000, "Paid search campaign"],
  [2, 16, "Naukri.com", "Operations", "HR", 25000, "Job postings"],
  [2, 19, "Swiggy", "Operations", "Operations", 7500, "Team meals"],
  [2, 22, "Reliance Jio", "Utilities", "Finance", 5500, "Connectivity"],
  [3, 6, "Zoom", "IT", "IT", 12000, "Video conferencing licences"],
  [3, 10, "Amazon Business", "Office Supplies", "Operations", 33000, "Consumables restock"],
  [3, 14, "Mailchimp", "Marketing", "Marketing", 18000, "Email marketing platform"],
  [3, 17, "WeWork", "Operations", "Operations", 28000, "Coworking desks"],
  [3, 21, "Zoho People", "IT", "HR", 14000, "HR software"],
  [3, 25, "Canva", "Marketing", "Marketing", 9000, "Design tool seats"],
];

// Budget slots for current month
const SAMPLE_BUDGETS = [
  { department: "IT", category: "", amount: 700000 },
  { department: "Marketing", category: "", amount: 300000 },
  { department: "Operations", category: "", amount: 200000 },
  { department: "HR", category: "", amount: 500000 },
  { department: "Finance", category: "", amount: 100000 },
  { department: "Sales", category: "Travel", amount: 60000 },
];

// Helpers

const api = async (method, endpoint, { body, token } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`http://127.0.0.1:${PORT}${endpoint}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
};

/** Sample workspace where the script stores and looks up its rows. */
const orgOf = (user) => user?.organizationId || DEFAULT_ORGANIZATION_ID;

/** Sample transactions currently stored in the workspace (identified by marker). */
const countSampleTransactions = (user) =>
  Transaction.countDocuments({ organizationId: orgOf(user), description: SAMPLE_PATTERN });

// Count sample budgets
const countSampleBudgets = async (user) => {
  const slots = SAMPLE_BUDGETS.map((budget) => ({
    department: new RegExp(`^${budget.department}$`, "i"),
    category: new RegExp(`^${budget.category}$`, "i"),
  }));

  return Budget.countDocuments({
    organizationId: orgOf(user),
    period: BUDGET_PERIOD,
    $or: slots,
  });
};

// Clean sample data
const cleanSampleData = async (user, token) => {
  const transactions = await Transaction.deleteMany({
    organizationId: orgOf(user),
    description: SAMPLE_PATTERN,
  });

  let budgets = 0;
  for (const budget of SAMPLE_BUDGETS) {
    const query =
      `period=${BUDGET_PERIOD}` +
      `&department=${encodeURIComponent(budget.department)}` +
      `&category=${encodeURIComponent(budget.category)}`;
    const list = await api("GET", `/api/budgets?${query}`, { token });

    for (const row of list.data?.budgets || []) {
      const removed = await api("DELETE", `/api/budgets/${row.id}`, { token });
      if (removed.status === 200) budgets += 1;
    }
  }

  return { transactions: transactions.deletedCount, budgets };
};

// Print budget statuses
const printBudgetOutcomes = async (token) => {
  const comparison = await api("GET", `/api/budgets/comparison?period=${BUDGET_PERIOD}`, { token });

  for (const row of comparison.data?.rows || []) {
    const label = row.category ? `${row.department} / ${row.category}` : row.department;
    console.log(
      `   ${label}: budget ${row.budget}, actual ${row.actual}, ${row.usagePercentage}% -> ${row.status}`
    );
  }
};

const main = async () => {
  if (process.env.NODE_ENV === "production" && !FORCE) {
    console.error("Refusing to seed sample data while NODE_ENV=production (use --force to override).");
    process.exit(1);
  }

  await connectDB();

  const target = await User.findOne({ email: TARGET_EMAIL.toLowerCase() });
  if (!target) {
    console.error(`No account found for "${TARGET_EMAIL}". Pass --email=<account email>.`);
    process.exit(1);
  }

  const token = signToken(target);
  const existingTransactions = await countSampleTransactions(target);
  const existingBudgets = await countSampleBudgets(target);

  console.log("RicozSpend sample data (development / testing only)");
  console.log(`Account: ${target.email} (${target.role})`);
  console.log(`Budget period: ${BUDGET_PERIOD}`);
  console.log(`Existing sample rows: ${existingTransactions} transactions, ${existingBudgets} budgets`);

  const server = app.listen(PORT);

  if (CLEAN_ONLY) {
    if (existingTransactions === 0 && existingBudgets === 0) {
      console.log("Nothing to clean.");
    } else {
      const removed = await cleanSampleData(target, token);
      console.log(`Removed ${removed.transactions} sample transaction(s) and ${removed.budgets} sample budget(s).`);
    }

    console.log(`Remaining: ${await countSampleTransactions(target)} sample transactions, ${await countSampleBudgets(target)} sample budgets`);
    server.close();
    await mongoose.connection.close();
    process.exit(0);
  }

  if ((existingTransactions > 0 || existingBudgets > 0) && !FORCE) {
    console.error("Sample data already exists. Use --force to replace it or npm run seed:sample:clean to remove it.");
    server.close();
    await mongoose.connection.close();
    process.exit(1);
  }

  if (existingTransactions > 0 || existingBudgets > 0) {
    const removed = await cleanSampleData(target, token);
    console.log(`Replaced the previous sample set: ${removed.transactions} transactions, ${removed.budgets} budgets removed.`);
  }

  // Create transactions via API
  const failures = [];
  let createdTransactions = 0;

  for (const [monthOffset, day, vendor, category, department, amount, description] of SAMPLE_TRANSACTIONS) {
    const result = await api("POST", "/api/transactions", {
      token,
      body: {
        date: isoDate(monthKey(monthOffset), day),
        vendor,
        category,
        department,
        amount,
        description: `${SAMPLE_MARKER} ${description}`,
      },
    });

    if (result.status === 201) {
      createdTransactions += 1;
    } else {
      failures.push(`${vendor} (${department}) ${amount}: ${result.status} ${JSON.stringify(result.data?.errors || result.data?.message)}`);
    }
  }

  console.log(`Created ${createdTransactions}/${SAMPLE_TRANSACTIONS.length} sample transactions.`);
  failures.slice(0, 5).forEach((entry) => console.error(`   FAILED ${entry}`));

  // Create budgets via API
  if (target.role === ROLES.ADMIN) {
    let createdBudgets = 0;

    for (const budget of SAMPLE_BUDGETS) {
      const result = await api("POST", "/api/budgets", {
        token,
        body: { ...budget, period: BUDGET_PERIOD },
      });

      if (result.status === 201) {
        createdBudgets += 1;
      } else {
        console.error(`   BUDGET FAILED ${budget.department}/${budget.category}: ${result.status} ${JSON.stringify(result.data?.message)}`);
      }
    }

    console.log(`Created ${createdBudgets}/${SAMPLE_BUDGETS.length} sample budgets for ${BUDGET_PERIOD}.`);
    await printBudgetOutcomes(token);
  } else {
    console.log("Budgets skipped: only Admin accounts can manage budgets.");
  }

  // Verify dashboard summary
  const dashboard = await api("GET", "/api/dashboard/summary?range=month", { token });
  console.log(
    `Dashboard (this month): ${dashboard.data?.transactionCount} transactions, total ${dashboard.data?.totalSpend}, top vendor ${dashboard.data?.topVendor?.name ?? "n/a"}.`
  );
  console.log(`Remove the sample data again with: npm run seed:sample:clean${TARGET_EMAIL ? ` -- --email=${TARGET_EMAIL}` : ""}`);

  server.close();
  await mongoose.connection.close();
  process.exit(failures.length === 0 ? 0 : 1);
};

main().catch(async (error) => {
  console.error("Seeding failed:", error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});



