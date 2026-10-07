/** Department Spending Patterns verification. */
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// P3-3: these scripts write/delete data - refuse to run against production unless explicitly forced
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to run this verification script with NODE_ENV=production (pass --force to override).");
  process.exit(1);
}

const mongoose = require("mongoose");
const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Transaction = require("../src/models/Transaction");
const { signToken } = require("../src/utils/token");

const { ROLES } = User;

const PORT = Number(process.env.VERIFY_DEPT_PORT || 5095);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ORG_PREFIX = "part13-verify-";
const RUN_ID = Date.now();
const ORG = `${ORG_PREFIX}${RUN_ID}`;
const EMPTY_ORG = `${ORG}-empty`;
const ORG_QUERY = { organizationId: { $regex: `^${ORG_PREFIX}` } };

let passed = 0;
const failures = [];

const check = (label, condition, details) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${details ? ` -> ${details}` : ""}`);
  }
};

const section = (title) => console.log(`\n=== ${title} ===`);

const api = async (method, endpoint, { token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
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

/** Department row by name from a department-spending payload. */
const row = (data, name) => (data?.departments || []).find((entry) => entry.name === name);

/** Known dataset (absolute dates keep the date-filter assertions stable) */
const FIXTURES = [
  { date: "2026-09-05", department: "IT", category: "IT", amount: 1000 },
  { date: "2026-09-12", department: "IT", category: "IT", amount: 500 },
  { date: "2026-09-18", department: "Marketing", category: "Ads", amount: 300 },
  { date: "2026-08-20", department: "HR", category: "Operations", amount: 200 },
];

const cleanup = async () => {
  await Transaction.deleteMany(ORG_QUERY);
  await User.deleteMany(ORG_QUERY);
};

const main = async () => {
  console.log("RicozSpend Part 13 - Department Spending Patterns verification");
  console.log(`Target: ${BASE_URL} (isolated workspace: ${ORG})`);

  await connectDB();
  const server = await new Promise((resolve) => {
    const instance = app.listen(PORT, () => resolve(instance));
  });

  try {
    // ----------------------------------------------------------- fixtures
    section("Fixtures (isolated workspace)");
    const admin = await User.create({
      name: "Part13 Admin",
      email: `part13.admin.${RUN_ID}@ricozspend.test`,
      password: "Part13Verify!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      organizationId: ORG,
    });
    const viewer = await User.create({
      name: "Part13 Viewer",
      email: `part13.viewer.${RUN_ID}@ricozspend.test`,
      password: "Part13Verify!",
      role: ROLES.VIEWER,
      isEmailVerified: true,
      organizationId: ORG,
    });
    const emptyUser = await User.create({
      name: "Part13 Empty",
      email: `part13.empty.${RUN_ID}@ricozspend.test`,
      password: "Part13Verify!",
      role: ROLES.VIEWER,
      isEmailVerified: true,
      organizationId: EMPTY_ORG,
    });

    await Transaction.insertMany(
      FIXTURES.map((entry) => ({
        ...entry,
        vendor: "Part13 Verify Vendor",
        description: "[part13-verify] fixture row",
        user: admin._id,
        organizationId: ORG,
      }))
    );

    const adminToken = signToken(admin);
    const viewerToken = signToken(viewer);
    const emptyToken = signToken(emptyUser);
    console.log(`  Created ${FIXTURES.length} fixture transactions in ${ORG}`);

    // ---------------------------------- totals / counts / percentages
    section("Department totals, transaction counts and percentages");
    const all = await api("GET", "/api/analytics/department-spending", { token: adminToken });
    check("Endpoint answers 200 for Admin", all.status === 200, JSON.stringify(all.data));
    check("Total spend = 2000", all.data?.totalSpend === 2000, all.data?.totalSpend);
    check("Transaction count = 4", all.data?.totalTransactions === 4, all.data?.totalTransactions);
    check("Department count = 3", all.data?.departmentCount === 3, all.data?.departmentCount);
    check("Rows sorted by spend desc (IT first)", all.data?.departments?.[0]?.name === "IT");

    const it = row(all.data, "IT");
    const marketing = row(all.data, "Marketing");
    const hr = row(all.data, "HR");
    check(
      "IT: 1500 / 2 txns / 75%",
      it?.totalSpend === 1500 && it?.transactionCount === 2 && it?.percentage === 75,
      JSON.stringify(it)
    );
    check(
      "Marketing: 300 / 1 txn / 15%",
      marketing?.totalSpend === 300 &&
        marketing?.transactionCount === 1 &&
        marketing?.percentage === 15,
      JSON.stringify(marketing)
    );
    check(
      "HR: 200 / 1 txn / 10%",
      hr?.totalSpend === 200 && hr?.transactionCount === 1 && hr?.percentage === 10,
      JSON.stringify(hr)
    );
    const shareSum = (all.data?.departments || []).reduce((sum, entry) => sum + entry.percentage, 0);
    check("Percentages add up to 100", shareSum === 100, shareSum);

    // ---------------------------------- highest + average (department spending stats)
    section("Highest-spending department + average per department");
    check(
      "Highest-spending department is IT with its stats",
      all.data?.highestSpendingDepartment?.name === "IT" &&
        all.data?.highestSpendingDepartment?.totalSpend === 1500 &&
        all.data?.highestSpendingDepartment?.percentage === 75,
      JSON.stringify(all.data?.highestSpendingDepartment)
    );
    check(
      "Average spend per department = 666.67 (2000/3)",
      all.data?.averageSpendPerDepartment === 666.67,
      all.data?.averageSpendPerDepartment
    );

    // ---------------------------------------------------------- filters
    section("Date range / department / category filters");
    const byDate = await api(
      "GET",
      "/api/analytics/department-spending?from=2026-09-01&to=2026-09-30",
      { token: adminToken }
    );
    check(
      "Sep range: 1800 / 3 txns / 2 departments",
      byDate.data?.totalSpend === 1800 &&
        byDate.data?.totalTransactions === 3 &&
        byDate.data?.departmentCount === 2,
      JSON.stringify(byDate.data)
    );
    check(
      "Sep range: average = 900 (1800/2)",
      byDate.data?.averageSpendPerDepartment === 900,
      byDate.data?.averageSpendPerDepartment
    );
    check(
      "Sep range: response echoes the window",
      byDate.data?.filters?.from === "2026-09-01" && byDate.data?.filters?.to === "2026-09-30"
    );

    const byDept = await api("GET", "/api/analytics/department-spending?department=IT", {
      token: adminToken,
    });
    check(
      "department=IT: 1500 / 2 txns / 100%",
      byDept.data?.totalSpend === 1500 &&
        byDept.data?.totalTransactions === 2 &&
        row(byDept.data, "IT")?.percentage === 100,
      JSON.stringify(byDept.data)
    );
    const byDeptCase = await api("GET", "/api/analytics/department-spending?department=it", {
      token: adminToken,
    });
    check(
      "department filter is case-insensitive",
      byDeptCase.data?.totalSpend === 1500,
      byDeptCase.data?.totalSpend
    );

    const byCategory = await api("GET", "/api/analytics/department-spending?category=Ads", {
      token: adminToken,
    });
    check(
      "category=Ads: 300 / 1 txn (Marketing only)",
      byCategory.data?.totalSpend === 300 &&
        byCategory.data?.departmentCount === 1 &&
        byCategory.data?.departments?.[0]?.name === "Marketing",
      JSON.stringify(byCategory.data)
    );

    const combined = await api(
      "GET",
      "/api/analytics/department-spending?from=2026-09-01&to=2026-09-30&category=IT",
      { token: adminToken }
    );
    check(
      "Combined date + category: 1500 / 2 txns",
      combined.data?.totalSpend === 1500 && combined.data?.totalTransactions === 2,
      JSON.stringify(combined.data)
    );

    const badDate = await api("GET", "/api/analytics/department-spending?from=not-a-date", {
      token: adminToken,
    });
    check("Invalid date range answers 400", badDate.status === 400, badDate.status);

    // ------------------------------------------------------ empty state
    section("Empty-data state (workspace without transactions)");
    const empty = await api("GET", "/api/analytics/department-spending", { token: emptyToken });
    check("Empty workspace answers 200", empty.status === 200, empty.status);
    check(
      "Empty: totals and counts are 0",
      empty.data?.totalSpend === 0 &&
        empty.data?.totalTransactions === 0 &&
        empty.data?.departmentCount === 0,
      JSON.stringify(empty.data)
    );
    check(
      "Empty: department list is empty",
      Array.isArray(empty.data?.departments) && empty.data.departments.length === 0
    );
    check(
      "Empty: highest is null and average is 0",
      empty.data?.highestSpendingDepartment === null &&
        empty.data?.averageSpendPerDepartment === 0,
      JSON.stringify(empty.data)
    );

    // ------------------------------ Admin/Viewer shared access + read-only
    section("Admin + Viewer shared access, Viewer read-only");
    const asViewer = await api("GET", "/api/analytics/department-spending", {
      token: viewerToken,
    });
    check("Viewer reads the same shared data (200)", asViewer.status === 200, asViewer.status);
    check(
      "Admin and Viewer payloads match",
      JSON.stringify(asViewer.data) === JSON.stringify(all.data)
    );
    const anon = await api("GET", "/api/analytics/department-spending");
    check("Anonymous request answers 401", anon.status === 401, anon.status);

    const viewerPost = await api("POST", "/api/analytics/department-spending", {
      token: viewerToken,
      body: { department: "Ghost", amount: 1 },
    });
    const viewerPut = await api("PUT", "/api/analytics/department-spending", {
      token: viewerToken,
      body: {},
    });
    const viewerDelete = await api("DELETE", "/api/analytics/department-spending", {
      token: viewerToken,
    });
    check(
      "No write route exists (POST/PUT/DELETE -> 404)",
      viewerPost.status === 404 && viewerPut.status === 404 && viewerDelete.status === 404,
      `${viewerPost.status}/${viewerPut.status}/${viewerDelete.status}`
    );
    const fixtureCount = await Transaction.countDocuments(ORG_QUERY);
    check("Fixture rows were not modified", fixtureCount === FIXTURES.length, fixtureCount);

    // --------------------------- Parts 1/3/4/6/9 regression smoke tests
    section("Existing features still work (Parts 1/3/4/6/9)");
    const root = await api("GET", "/");
    check("Part 1: GET / still answers", root.status === 200, root.status);

    const dashboard = await api(
      "GET",
      "/api/dashboard/summary?range=custom&from=2026-08-01&to=2026-09-30",
      { token: adminToken }
    );
    check(
      "Part 3: dashboard summary = 4 txns / 2000",
      dashboard.status === 200 &&
        dashboard.data?.transactionCount === 4 &&
        dashboard.data?.totalSpend === 2000,
      JSON.stringify(dashboard.data)
    );

    const list = await api("GET", "/api/transactions", { token: viewerToken });
    check(
      "Part 4: transactions list = 4 total for Viewer",
      list.status === 200 && list.data?.total === 4,
      `${list.status} total=${list.data?.total}`
    );

    const summary = await api("GET", "/api/analytics/summary", { token: adminToken });
    check(
      "Part 6: analytics summary = 200 with facets",
      summary.status === 200 &&
        summary.data?.kpis?.transactionCount === 4 &&
        (summary.data?.facets?.departments || []).includes("IT"),
      JSON.stringify(summary.data?.kpis)
    );

    const vendors = await api("GET", "/api/analytics/vendor-comparison", { token: adminToken });
    check("Part 9: vendor comparison still answers 200", vendors.status === 200, vendors.status);
  } finally {
    section("Cleanup (removing the isolated workspace)");
    await cleanup();
    console.log("  Removed part13-verify users and transactions.");
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n================ RESULT ================");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failures.length}`);
  if (failures.length) failures.forEach((label) => console.log(`   - ${label}`));
  console.log("========================================");

  await mongoose.disconnect();
  process.exit(failures.length ? 1 : 0);
};

main().catch(async (error) => {
  console.error("\nVerification crashed:", error);
  await cleanup().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});