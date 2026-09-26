/**
 * Part 14/15 verification - Alerts & Insights Center + Admin-configurable rules.
 *
 * Creates ISOLATED workspaces (organizationId "part14-verify-*") with known
 * transactions and budgets, then checks GET /api/insights end to end:
 *   - all four sections (budget / unusual / spending / activity) with the
 *     exact alerts, severities, ordering, messages and raw numeric meta
 *   - every severity rule: critical = budget usage >= the critical/exceeded
 *     rule, warning = budget usage >= the warning rule / unusual transaction /
 *     month-over-month increase at or above the configured percentage,
 *     insight = tops + contributions + month-over-month decrease,
 *     info = activity + honest empty states
 *   - the DEFAULT_ALERT_RULES thresholds (70 / 90 / 100 / 50% above average / 20%)
 *     and the Admin-only /api/alert-rules editor (Part 15): defaults, validation
 *     errors, Viewer 403, persistence and the fact that saved values really do
 *     change the generated alerts (tiers, unusual rule, increase rule)
 *   - summary counts that always match the sections, the periods facet,
 *     currency-free messages and raw amounts (formatting stays client-side)
 *   - the empty workspace (info-only notices) and the healthy workspace
 *   - Admin + Viewer shared READ access, anonymous 401, no write route
 *   - regression smoke tests for Parts 1/3/4/6/7/8/9/13
 *
 * Fixtures (and any saved alert-rules document) live only in the temporary orgs
 * and are removed afterwards (also on crash), so the default RicozSpend
 * workspace is never touched.
 *
 * Run from Server/: npm run verify:alerts
 */

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// P3-3: these scripts write/delete data - refuse to run against production
// unless explicitly forced, so a staging .env can never nuke real data.
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to run this verification script with NODE_ENV=production (pass --force to override).");
  process.exit(1);
}

const mongoose = require("mongoose");
const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const Transaction = require("../src/models/Transaction");
const Budget = require("../src/models/Budget");
const AlertRule = require("../src/models/AlertRule");
const { DEFAULT_ALERT_RULES } = require("../src/utils/alertRules");
const { signToken } = require("../src/utils/token");
const { ROLES } = User;

const PORT = Number(process.env.VERIFY_ALERTS_PORT || 5096);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const RUN_ID = Date.now();
const ORG_PREFIX = "part14-verify-";
const MAIN_ORG = `${ORG_PREFIX}${RUN_ID}`;
const EMPTY_ORG = `${MAIN_ORG}-empty`;
const HEALTHY_ORG = `${MAIN_ORG}-healthy`;
const ORG_QUERY = { organizationId: { $regex: `^${ORG_PREFIX}` } };

const SEVERITIES = ["critical", "warning", "insight", "info"];
const SECTION_KEYS = ["budget", "unusual", "spending", "activity"];

let passed = 0;
let failed = 0;

const section = (name) => console.log(`\n${name}`);
const check = (label, ok, detail = "") => {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`);
  }
};

/** Tiny HTTP helper: api("GET", "/api/insights", { token }) */
const api = async (method, url, { token, body } = {}) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
};

/* --------------------------------------------------------------- payload helpers */

const findAlert = (data, id) =>
  Object.values(data?.sections || {})
    .flat()
    .find((alert) => alert.id === id);

const sectionLength = (data, key) => data?.sections?.[key]?.length ?? -1;
const sevCount = (data, severity) =>
  Object.values(data?.sections || {})
    .flat()
    .filter((alert) => alert.severity === severity).length;

/* -------------------------------------------------------------------- fixtures */

/**
 * Main workspace - designed to light up every rule:
 *   6 txns / 4500 total; average 750; unusual threshold 1125 (default 1.5x)
 *   Aug 700 -> Sep 3800 (+442.9%, increase = warning, default 20% rule)
 *   Categories: Airfare 2400, Software 1100, Ads 900, Supplies 100
 *   Budgets: 550->600 (109.09% exceeded), 800->700 (87.5% warning),
 *            500->400 (80% warning), 400->100 (25% silent)
 */
const FIXTURES = [
  { date: "2026-08-03", department: "IT", category: "Software", amount: 400, vendor: "CloudBase" },
  { date: "2026-08-14", department: "Marketing", category: "Ads", amount: 300, vendor: "AdWorks" },
  { date: "2026-09-02", department: "IT", category: "Software", amount: 700, vendor: "CloudBase" },
  { date: "2026-09-10", department: "Marketing", category: "Ads", amount: 600, vendor: "AdWorks" },
  { date: "2026-09-17", department: "Travel", category: "Airfare", amount: 2400, vendor: "JetSet Travels" },
  { date: "2026-09-21", department: "Office", category: "Supplies", amount: 100, vendor: "OfficeMart" },
];

const BUDGET_FIXTURES = [
  { department: "Marketing", category: "Ads", period: "2026-09", amount: 550 },
  { department: "IT", category: "Software", period: "2026-09", amount: 800 },
  { department: "IT", category: "Software", period: "2026-08", amount: 500 },
  { department: "Office", category: "Supplies", period: "2026-09", amount: 400 },
];

/**
 * Healthy workspace - decrease month trend, nothing unusual, budget under
 * the warning line:
 *   2 txns / 300 total; average 150; threshold 225 -> no unusual txns
 *   Jul 200 -> Aug 100 (-50% = decrease = insight)
 *   Budget Office / Supplies 2026-08: 500 planned, 100 actual (20%) = healthy
 */
const HEALTHY_FIXTURES = [
  { date: "2026-07-05", department: "Travel", category: "Flights", amount: 200, vendor: "SkyJet" },
  { date: "2026-08-12", department: "Office", category: "Supplies", amount: 100, vendor: "OfficeMart" },
];

const HEALTHY_BUDGET_FIXTURES = [
  { department: "Office", category: "Supplies", period: "2026-08", amount: 500 },
];

/* ----------------------------------------------------------------- housekeeping */

const cleanup = async () => {
  await Transaction.deleteMany(ORG_QUERY);
  await Budget.deleteMany(ORG_QUERY);
  await User.deleteMany(ORG_QUERY);
  // Part 15: any alert-rules document saved by the run is removed too.
  await AlertRule.deleteMany(ORG_QUERY);
};

const main = async () => {
  console.log("RicozSpend Part 14 - Alerts & Insights Center verification");
  console.log(`Target: ${BASE_URL} (isolated workspaces: ${MAIN_ORG}, ${EMPTY_ORG}, ${HEALTHY_ORG})`);

  await connectDB();
  const server = await new Promise((resolve) => {
    const instance = app.listen(PORT, () => resolve(instance));
  });

  try {
    // ----------------------------------------------------------- fixtures
    section("Fixtures (isolated workspaces)");
    const admin = await User.create({
      name: "Part14 Admin",
      email: `part14.admin.${RUN_ID}@ricozspend.test`,
      password: "Part14Verify!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      organizationId: MAIN_ORG,
    });
    const viewer = await User.create({
      name: "Part14 Viewer",
      email: `part14.viewer.${RUN_ID}@ricozspend.test`,
      password: "Part14Verify!",
      role: ROLES.VIEWER,
      isEmailVerified: true,
      organizationId: MAIN_ORG,
    });
    const emptyUser = await User.create({
      name: "Part14 Empty",
      email: `part14.empty.${RUN_ID}@ricozspend.test`,
      password: "Part14Verify!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      organizationId: EMPTY_ORG,
    });
    const healthyUser = await User.create({
      name: "Part14 Healthy",
      email: `part14.healthy.${RUN_ID}@ricozspend.test`,
      password: "Part14Verify!",
      role: ROLES.ADMIN,
      isEmailVerified: true,
      organizationId: HEALTHY_ORG,
    });

    await Transaction.insertMany(
      FIXTURES.map((entry) => ({
        ...entry,
        description: "[part14-verify] fixture row",
        user: admin._id,
        organizationId: MAIN_ORG,
      }))
    );
    await Budget.insertMany(
      BUDGET_FIXTURES.map((entry) => ({
        ...entry,
        user: admin._id,
        createdBy: admin._id,
        organizationId: MAIN_ORG,
      }))
    );
    await Transaction.insertMany(
      HEALTHY_FIXTURES.map((entry) => ({
        ...entry,
        description: "[part14-verify] healthy row",
        user: healthyUser._id,
        organizationId: HEALTHY_ORG,
      }))
    );
    await Budget.insertMany(
      HEALTHY_BUDGET_FIXTURES.map((entry) => ({
        ...entry,
        user: healthyUser._id,
        createdBy: healthyUser._id,
        organizationId: HEALTHY_ORG,
      }))
    );

    const adminToken = signToken(admin);
    const viewerToken = signToken(viewer);
    const emptyToken = signToken(emptyUser);
    const healthyToken = signToken(healthyUser);
    console.log(
      `  Seeded ${FIXTURES.length} txns + ${BUDGET_FIXTURES.length} budgets (main), ` +
        `${HEALTHY_FIXTURES.length} txns + 1 budget (healthy), 0 (empty)`
    );

    // ------------------------------------------------- payload shape
    section("Payload shape");
    const all = await api("GET", "/api/insights", { token: adminToken });
    check("GET /api/insights answers 200 for Admin", all.status === 200, JSON.stringify(all.data));
    const data = all.data || {};
    check(
      "Payload has generatedAt / summary / periods / sections / meta",
      Boolean(data.generatedAt) && Boolean(data.summary) && Array.isArray(data.periods) &&
        Boolean(data.sections) && Boolean(data.meta)
    );
    check(
      "Sections are exactly budget / unusual / spending / activity",
      Object.keys(data.sections || {}).join(",") === SECTION_KEYS.join(","),
      Object.keys(data.sections || {}).join(",")
    );

    const alerts = Object.values(data.sections || {}).flat();
    check(
      "Every alert carries id / section / severity / title / message / amount / periodKey / timestamp / meta",
      alerts.every(
        (a) =>
          typeof a.id === "string" && a.id.length > 0 &&
          SECTION_KEYS.includes(a.section) &&
          SEVERITIES.includes(a.severity) &&
          typeof a.title === "string" && a.title.length > 0 &&
          typeof a.message === "string" && a.message.length > 0 &&
          (a.amount === null || typeof a.amount === "number") &&
          (a.periodKey === null || typeof a.periodKey === "string") &&
          (a.timestamp === null || typeof a.timestamp === "string") &&
          typeof a.meta === "object" && a.meta !== null
      ),
      JSON.stringify(alerts[0] || null)
    );
    check(
      "Each alert's section field matches the array it lives in",
      Object.entries(data.sections).every(([key, list]) => list.every((a) => a.section === key))
    );
    check(
      "Alert ids are unique across the payload",
      new Set(alerts.map((a) => a.id)).size === alerts.length
    );
    check(
      "Amounts are raw numbers and messages are currency-free (formatting stays client-side)",
      alerts.every((a) => !/[$₹€£¥]/.test(a.message) && !/[$₹€£¥]/.test(a.title))
    );

    // -------------------------------------------------- budget section
    section("Budget section (severity + thresholds from Part 9)");
    const budgetSection = data.sections.budget;
    check(
      "Exactly 3 budget alerts: 1 critical + 2 warning, one under-budget row silent",
      budgetSection.length === 3,
      `got ${budgetSection.length}`
    );
    check(
      "Budget alerts sorted by severity rank, then usage percentage descending",
      budgetSection.map((a) => a.severity).join(",") === "critical,warning,warning" &&
        budgetSection.map((a) => a.meta.usagePercentage).join(",") === "109.09,87.5,80" &&
        budgetSection.map((a) => a.title).join("|") ===
          "Budget exceeded|Budget nearly exhausted|Budget nearly exhausted",
      JSON.stringify(budgetSection.map((a) => [a.severity, a.meta.usagePercentage]))
    );

    const over = budgetSection[0];
    check(
      "Over-budget alert (>=100%) is critical with raw meta and message facts",
      over && over.id.startsWith("budget-") && over.title === "Budget exceeded" &&
        over.periodKey === "2026-09" && over.amount === 600 &&
        over.meta.usagePercentage === 109.09 && over.meta.budget === 550 &&
        over.meta.actual === 600 && over.meta.remaining === -50 &&
        over.meta.status === "Over Budget" &&
        over.message.includes("109.09%") && over.message.includes("2026-09") &&
        over.message.includes("Marketing / Ads"),
      JSON.stringify(over)
    );
    const edge = budgetSection[2];
    check(
      "Warning rule (default 70%) warns the 80% row; the 25% row raises nothing",
      edge && edge.severity === "warning" && edge.meta.usagePercentage === 80 &&
        edge.meta.alertLevel === "warning" &&
        edge.message.includes("70% warning level") &&
        data.meta.budget.budgetCount === 4,
      JSON.stringify(edge && edge.meta)
    );
    check(
      "meta.budget mirrors the Part 9 comparison (raw totals + live thresholds)",
      data.meta.budget.totals.totalBudget === 2250 &&
        data.meta.budget.totals.actualSpend === 4500 &&
        data.meta.budget.totals.remainingBudget === -2250 &&
        data.meta.budget.totals.usagePercentage === 200 &&
        data.meta.budget.overBudget === 1 && data.meta.budget.nearBudget === 2 &&
        data.meta.budget.exceeded === 1 && data.meta.budget.critical === 0 &&
        data.meta.budget.thresholds.warning === 70 &&
        data.meta.budget.thresholds.critical === 90 &&
        data.meta.budget.thresholds.exceeded === 100,
      JSON.stringify(data.meta.budget)
    );

    // ------------------------------------------- unusual section (Part 7)
    section("Unusual spending section (Part 7 threshold)");
    const unusualSection = data.sections.unusual;
    const weird = unusualSection[0];
    check(
      "Exactly 1 warning for the transaction above the default 1.5x threshold",
      unusualSection.length === 1 && weird && weird.severity === "warning" &&
        weird.title === "Unusual spending" && weird.id.startsWith("unusual-"),
      JSON.stringify(unusualSection)
    );
    check(
      "Unusual alert carries date/vendor facts + raw numeric meta",
      weird && weird.amount === 2400 && weird.periodKey === "2026-09" &&
        typeof weird.timestamp === "string" && weird.timestamp.startsWith("2026-09-17") &&
        weird.meta.date === "2026-09-17" && weird.meta.vendor === "JetSet Travels" &&
        weird.meta.threshold === 1125 && weird.meta.averageTransaction === 750 &&
        weird.meta.multiplier === 1.5 && weird.meta.percentAboveAverage === 50 &&
        weird.meta.differenceFromAverage === 1650 &&
        weird.message.includes("2026-09-17") && weird.message.includes("JetSet Travels") &&
        weird.message.includes("1.5x"),
      JSON.stringify(weird)
    );
    check(
      "meta.unusual mirrors the Part 7 helper (6 txns / avg 750 / threshold 1125 / 1 hit)",
      data.meta.unusual.transactionCount === 6 &&
        data.meta.unusual.averageTransaction === 750 &&
        data.meta.unusual.threshold === 1125 && data.meta.unusual.unusualCount === 1 &&
        data.meta.unusual.multiplier === 1.5 && data.meta.unusual.percentAboveAverage === 50,
      JSON.stringify(data.meta.unusual)
    );

    // ------------------------------------------- spending section (Part 8)
    section("Spending insights section (Part 8 payload)");
    const spendingSection = data.sections.spending;
    check(
      "Spending section: 5 alerts = 1 trend warning + 4 insights",
      spendingSection.length === 5 &&
        spendingSection.filter((a) => a.severity === "warning").length === 1 &&
        spendingSection.filter((a) => a.severity === "insight").length === 4,
      JSON.stringify(spendingSection.map((a) => [a.id, a.severity]))
    );

    const trend = findAlert(data, "spending-month-trend");
    check(
      "MoM increase is a warning with the real percentage and month labels",
      trend && trend.severity === "warning" && trend.title === "Spending increased" &&
        trend.meta.direction === "increase" && trend.meta.changePercentage === 442.9 &&
        trend.meta.currentSpend === 3800 && trend.meta.previousSpend === 700 &&
        trend.amount === 3800 && trend.periodKey === null &&
        trend.message.includes("442.9%") &&
        trend.message.includes(trend.meta.currentMonth) &&
        trend.message.includes(trend.meta.previousMonth),
      JSON.stringify(trend && trend.meta)
    );

    const topCat = findAlert(data, "spending-top-category");
    const topDept = findAlert(data, "spending-top-department");
    const topVend = findAlert(data, "spending-top-vendor");
    check(
      "Top category / department / vendor are insights with raw shares",
      [topCat, topDept, topVend].every(
        (a) => a && a.severity === "insight" && a.meta.share === 53.3 &&
          a.meta.totalSpend === 4500 && typeof a.meta.count === "number"
      ) &&
        topCat.meta.name === "Airfare" && topCat.amount === 2400 && topCat.meta.count === 1 &&
        topDept.meta.name === "Travel" && topVend.meta.name === "JetSet Travels" &&
        topCat.message.includes("53.3%"),
      JSON.stringify([topCat && topCat.meta, topDept && topDept.meta])
    );

    const contrib = findAlert(data, "spending-category-contribution");
    check(
      "Category contribution lists every category >= 5% (3 of 4, Supplies excluded)",
      contrib && contrib.severity === "insight" && contrib.amount === null &&
        contrib.meta.contributions.length === 3 &&
        contrib.meta.contributions.map((c) => c.name).join(",") === "Airfare,Software,Ads" &&
        contrib.meta.contributions.map((c) => c.share).join(",") === "53.3,24.4,20" &&
        contrib.message.includes("Airfare 53.3%"),
      JSON.stringify(contrib && contrib.meta.contributions)
    );
    check(
      "meta.insights mirrors the Part 8 payload (direction + tops + spend)",
      data.meta.insights.transactionCount === 6 && data.meta.insights.totalSpend === 4500 &&
        data.meta.insights.direction === "increase" &&
        data.meta.insights.topCategory === "Airfare" &&
        data.meta.insights.topDepartment === "Travel" &&
        data.meta.insights.topVendor === "JetSet Travels",
      JSON.stringify(data.meta.insights)
    );

    // ------------------------------------------------- activity section
    section("Activity section (honest state notices)");
    const activitySection = data.sections.activity;
    const snapshot = findAlert(data, "activity-snapshot");
    check(
      "While alerts exist elsewhere, activity shows one info snapshot only",
      activitySection.length === 1 && snapshot && snapshot.severity === "info" &&
        snapshot.amount === 4500 && snapshot.meta.count === 6 &&
        snapshot.meta.averageTransaction === 750 &&
        snapshot.message.includes("6 transactions recorded"),
      JSON.stringify(activitySection)
    );
    check(
      "No empty-state notices are shown when data exists",
      !findAlert(data, "activity-no-transactions") && !findAlert(data, "activity-no-budgets") &&
        !findAlert(data, "activity-no-unusual") && !findAlert(data, "activity-budgets-healthy")
    );

    // ---------------------------------------- summary + periods facet
    section("Summary counts and periods facet");
    check(
      "summary.total always equals the sum of the four sections",
      data.summary.total ===
        sectionLength(data, "budget") + sectionLength(data, "unusual") +
          sectionLength(data, "spending") + sectionLength(data, "activity"),
      JSON.stringify(data.summary)
    );
    check(
      "summary severity counts match the actual alerts",
      data.summary.critical === sevCount(data, "critical") &&
        data.summary.warning === sevCount(data, "warning") &&
        data.summary.insight === sevCount(data, "insight") &&
        data.summary.info === sevCount(data, "info")
    );
    check(
      "summary.sections mirrors the section lengths",
      JSON.stringify(data.summary.sections) ===
        JSON.stringify({ budget: 3, unusual: 1, spending: 5, activity: 1 }),
      JSON.stringify(data.summary.sections)
    );
    check(
      "Exact totals: 10 alerts = 1 critical / 4 warning / 4 insight / 1 info",
      data.summary.total === 10 && data.summary.critical === 1 &&
        data.summary.warning === 4 && data.summary.insight === 4 && data.summary.info === 1,
      JSON.stringify(data.summary)
    );
    check(
      "periods facet = only periods carried by alerts, newest first",
      data.periods.join(",") === "2026-09,2026-08",
      JSON.stringify(data.periods)
    );

    // ------------------------------------------------ empty workspace
    section("Empty workspace (honest info-only state)");
    const emptyRes = await api("GET", "/api/insights", { token: emptyToken });
    check("GET /api/insights answers 200 for the empty workspace", emptyRes.status === 200,
      JSON.stringify(emptyRes.data));
    const emptyData = emptyRes.data || {};
    check(
      "Empty: budget / unusual / spending sections carry no alerts",
      sectionLength(emptyData, "budget") === 0 && sectionLength(emptyData, "unusual") === 0 &&
        sectionLength(emptyData, "spending") === 0,
      JSON.stringify(emptyData.sections && Object.keys(emptyData.sections).map(
        (key) => [key, emptyData.sections[key].length]
      ))
    );
    const emptyActivity = emptyData.sections?.activity || [];
    check(
      "Empty: exactly two info notices (no transactions, no budgets)",
      emptyActivity.length === 2 &&
        emptyActivity.map((a) => a.id).join(",") ===
          "activity-no-transactions,activity-no-budgets" &&
        emptyActivity.every((a) => a.severity === "info"),
      JSON.stringify(emptyActivity.map((a) => [a.id, a.severity]))
    );
    check(
      "Empty: summary is info-only and periods is empty",
      emptyData.summary.total === 2 && emptyData.summary.critical === 0 &&
        emptyData.summary.warning === 0 && emptyData.summary.insight === 0 &&
        emptyData.summary.info === 2 &&
        JSON.stringify(emptyData.summary.sections) ===
          JSON.stringify({ budget: 0, unusual: 0, spending: 0, activity: 2 }) &&
        emptyData.periods.length === 0,
      JSON.stringify(emptyData.summary)
    );
    check(
      "Empty: meta reports zeros instead of invented numbers",
      emptyData.meta.budget.budgetCount === 0 &&
        emptyData.meta.budget.totals.totalBudget === 0 &&
        emptyData.meta.budget.totals.usagePercentage === 0 &&
        emptyData.meta.budget.overBudget === 0 && emptyData.meta.budget.nearBudget === 0 &&
        emptyData.meta.unusual.transactionCount === 0 &&
        emptyData.meta.unusual.unusualCount === 0 &&
        emptyData.meta.insights.transactionCount === 0 &&
        emptyData.meta.insights.direction === "insufficient_data" &&
        emptyData.meta.insights.topCategory === null,
      JSON.stringify(emptyData.meta)
    );

    // ------------------------------------- healthy workspace (all green)
    section("Healthy workspace (decrease / nothing unusual / budgets healthy)");
    const healthyRes = await api("GET", "/api/insights", { token: healthyToken });
    check("GET /api/insights answers 200 for the healthy workspace", healthyRes.status === 200,
      JSON.stringify(healthyRes.data));
    const healthyData = healthyRes.data || {};
    check(
      "Healthy: no budget and no unusual alerts",
      sectionLength(healthyData, "budget") === 0 && sectionLength(healthyData, "unusual") === 0,
      JSON.stringify(healthyData.sections && Object.keys(healthyData.sections).map(
        (key) => [key, healthyData.sections[key].length]
      ))
    );

    const hTrend = findAlert(healthyData, "spending-month-trend");
    check(
      "MoM decrease is an insight with a positive 'lower' percentage (no -50% wording)",
      hTrend && hTrend.severity === "insight" && hTrend.title === "Spending decreased" &&
        hTrend.meta.direction === "decrease" && hTrend.meta.changePercentage === -50 &&
        hTrend.message.includes("50% lower") && !hTrend.message.includes("-50%"),
      JSON.stringify(hTrend && [hTrend.message, hTrend.meta.changePercentage])
    );
    check(
      "Healthy spending = 5 insights (trend + 3 tops + contribution)",
      sectionLength(healthyData, "spending") === 5 &&
        (healthyData.sections.spending || []).every((a) => a.severity === "insight"),
      JSON.stringify(healthyData.sections.spending && healthyData.sections.spending.map((a) => a.id))
    );

    const noUnusual = findAlert(healthyData, "activity-no-unusual");
    const healthyBudgets = findAlert(healthyData, "activity-budgets-healthy");
    check(
      "'No unusual spending' + 'All budgets healthy' info notices appear",
      noUnusual && noUnusual.severity === "info" && noUnusual.meta.threshold === 225 &&
        healthyBudgets && healthyBudgets.severity === "info" &&
        healthyBudgets.message.includes("All 1 budgets") &&
        healthyBudgets.message.includes("70% warning level"),
      JSON.stringify([noUnusual && noUnusual.id, healthyBudgets && healthyBudgets.message])
    );
    check(
      "Healthy activity = 3 info notices including the transaction snapshot",
      sectionLength(healthyData, "activity") === 3 &&
        (healthyData.sections.activity || []).every((a) => a.severity === "info") &&
        Boolean(findAlert(healthyData, "activity-snapshot")),
      JSON.stringify(healthyData.sections.activity && healthyData.sections.activity.map((a) => a.id))
    );
    check(
      "Healthy summary: 8 alerts = 0 critical / 0 warning / 5 insight / 3 info",
      healthyData.summary.total === 8 && healthyData.summary.critical === 0 &&
        healthyData.summary.warning === 0 && healthyData.summary.insight === 5 &&
        healthyData.summary.info === 3 &&
        JSON.stringify(healthyData.summary.sections) ===
          JSON.stringify({ budget: 0, unusual: 0, spending: 5, activity: 3 }),
      JSON.stringify(healthyData.summary)
    );
    check(
      "Healthy meta: real decrease direction, Flights tops, 1 healthy budget, 0 unusual",
      healthyData.meta.insights.direction === "decrease" &&
        healthyData.meta.insights.topCategory === "Flights" &&
        healthyData.meta.insights.topDepartment === "Travel" &&
        healthyData.meta.insights.topVendor === "SkyJet" &&
        healthyData.meta.budget.budgetCount === 1 &&
        healthyData.meta.budget.overBudget === 0 && healthyData.meta.budget.nearBudget === 0 &&
        healthyData.meta.unusual.unusualCount === 0 && healthyData.meta.unusual.threshold === 225,
      JSON.stringify(healthyData.meta)
    );

    // ------------------------------------ roles and read-only surface
    section("Roles and read-only surface");
    const asViewer = await api("GET", "/api/insights", { token: viewerToken });
    const strip = ({ generatedAt, ...rest }) => rest;
    check(
      "Viewer reads the same shared data (200, identical payload minus generatedAt)",
      asViewer.status === 200 &&
        JSON.stringify(strip(asViewer.data || {})) === JSON.stringify(strip(data)),
      JSON.stringify(asViewer.data && asViewer.data.summary)
    );

    const anon = await api("GET", "/api/insights");
    check("Anonymous request answers 401", anon.status === 401, JSON.stringify(anon.data));

    const post = await api("POST", "/api/insights", { token: adminToken, body: {} });
    const put = await api("PUT", "/api/insights", { token: adminToken, body: {} });
    const del = await api("DELETE", "/api/insights", { token: adminToken });
    check(
      "No write route exists (POST / PUT / DELETE answer 404)",
      post.status === 404 && put.status === 404 && del.status === 404,
      JSON.stringify([post.status, put.status, del.status])
    );

    // --------------------------------------------- fixture integrity
    section("Fixture integrity (read-only verification)");
    const txnCount = await Transaction.countDocuments(ORG_QUERY);
    const budgetCount = await Budget.countDocuments(ORG_QUERY);
    check(
      "Verification never mutates data: 8 transactions and 5 budgets intact",
      txnCount === 8 && budgetCount === 5,
      JSON.stringify({ txnCount, budgetCount })
    );

    // ------------------------------------- regression smoke (Parts 1-13)
    section("Regression smoke tests (Parts 1/3/4/6/7/8/9/13)");
    const root = await api("GET", "/");
    check("Part 1: GET / still answers 200", root.status === 200);

    const dash = await api(
      "GET",
      "/api/dashboard/summary?range=custom&from=2026-08-01&to=2026-09-30",
      { token: adminToken }
    );
    check(
      "Part 3: dashboard summary = 6 transactions / 4500 over Aug-Sep",
      dash.status === 200 && dash.data?.transactionCount === 6 && dash.data?.totalSpend === 4500,
      JSON.stringify(dash.data)
    );

    const txList = await api("GET", "/api/transactions?page=1&limit=1", { token: adminToken });
    check(
      "Part 4: transactions list = 6 total",
      txList.status === 200 && txList.data?.total === 6,
      JSON.stringify({ status: txList.status, total: txList.data?.total })
    );

    const summary6 = await api("GET", "/api/analytics/summary", { token: adminToken });
    check(
      "Part 6: analytics summary = 6 txns / 4500 with an IT facet",
      summary6.status === 200 && summary6.data?.kpis?.transactionCount === 6 &&
        summary6.data?.kpis?.totalSpend === 4500 &&
        (summary6.data?.facets?.departments || []).includes("IT"),
      JSON.stringify(summary6.data && summary6.data.kpis)
    );

    const unusual7 = await api("GET", "/api/analytics/unusual-spending", { token: adminToken });
    check(
      "Part 7: unusual-spending still reports 1 hit / threshold 1125 (default 1.5x)",
      unusual7.status === 200 && unusual7.data?.unusualCount === 1 &&
        unusual7.data?.threshold === 1125,
      JSON.stringify(unusual7.data && {
        unusualCount: unusual7.data.unusualCount,
        threshold: unusual7.data.threshold,
      })
    );

    const insights8 = await api("GET", "/api/analytics/insights", { token: adminToken });
    check(
      "Part 8: spend insights still report the increase direction",
      insights8.status === 200 && insights8.data?.monthComparison?.direction === "increase",
      JSON.stringify(insights8.data && insights8.data.monthComparison)
    );

    const budgets9 = await api("GET", "/api/budgets/comparison", { token: adminToken });
    check(
      "Part 9: budget comparison still reports 4 budgets",
      budgets9.status === 200 && budgets9.data?.budgetCount === 4,
      JSON.stringify({ status: budgets9.status, budgetCount: budgets9.data?.budgetCount })
    );

    const dept13 = await api("GET", "/api/analytics/department-spending", { token: adminToken });
    check(
      "Part 13: department-spending = 4500 across 4 departments",
      dept13.status === 200 && dept13.data?.totalSpend === 4500 &&
        dept13.data?.departmentCount === 4,
      JSON.stringify({ status: dept13.status, totalSpend: dept13.data?.totalSpend,
        departmentCount: dept13.data?.departmentCount })
    );
    // ---------------------------- Part 15: Admin-configurable alert rules
    section("Alert rules (Part 15 - Admin-only, configurable thresholds)");

    const anonRules = await api("GET", "/api/alert-rules");
    check("Anonymous cannot read the rules (401)", anonRules.status === 401);

    const viewerRules = await api("GET", "/api/alert-rules", { token: viewerToken });
    check("Viewer cannot read the rules editor (403)", viewerRules.status === 403,
      JSON.stringify(viewerRules.data));

    const viewerPut = await api("PUT", "/api/alert-rules", {
      token: viewerToken,
      body: DEFAULT_ALERT_RULES,
    });
    check("Viewer cannot change alert rules (403)", viewerPut.status === 403,
      JSON.stringify(viewerPut.data));

    const defaultRules = await api("GET", "/api/alert-rules", { token: adminToken });
    check(
      "Admin reads the sensible defaults before anything is saved",
      defaultRules.status === 200 && defaultRules.data?.isCustom === false &&
        JSON.stringify(defaultRules.data?.rules) === JSON.stringify(DEFAULT_ALERT_RULES) &&
        JSON.stringify(defaultRules.data?.defaults) === JSON.stringify(DEFAULT_ALERT_RULES) &&
        (defaultRules.data?.fields || []).length === 5,
      JSON.stringify(defaultRules.data)
    );
    check(
      "The alerts payload publishes the same effective defaults (meta.rules)",
      JSON.stringify(data.meta.rules) === JSON.stringify(DEFAULT_ALERT_RULES),
      JSON.stringify(data.meta.rules)
    );

    /* --- validation: every rejection must answer 400 + field errors ------ */
    const invalidCases = [
      ["no values at all", {}],
      ["non-numeric value", { ...DEFAULT_ALERT_RULES, budgetWarning: "abc" }],
      ["out-of-range value", { ...DEFAULT_ALERT_RULES, budgetWarning: 0 }],
      ["critical not above warning", { ...DEFAULT_ALERT_RULES, budgetWarning: 95 }],
      ["exceeded below critical", { ...DEFAULT_ALERT_RULES, budgetCritical: 99, budgetExceeded: 98 }],
    ];

    for (const [label, body] of invalidCases) {
      const rejected = await api("PUT", "/api/alert-rules", { token: adminToken, body });
      check(
        `Invalid rules rejected (${label}) with per-field errors`,
        rejected.status === 400 && rejected.data?.errors &&
          Object.keys(rejected.data.errors).length > 0 &&
          typeof rejected.data.message === "string",
        JSON.stringify(rejected.data)
      );
    }
    const afterRejections = await AlertRule.findOne({ organizationId: MAIN_ORG });
    check("Rejected saves never write a rules document", afterRejections === null,
      JSON.stringify(afterRejections));
    /* --- a valid save really does drive the alerts ----------------------- */
    const customRules = {
      budgetWarning: 60,
      budgetCritical: 85,
      budgetExceeded: 95,
      unusualSpending: 300,
      spendingIncrease: 500,
    };
    const saved = await api("PUT", "/api/alert-rules", { token: adminToken, body: customRules });
    check(
      "Admin saves custom rules (200 + echoed values + isCustom)",
      saved.status === 200 && saved.data?.isCustom === true &&
        JSON.stringify(saved.data?.rules) === JSON.stringify(customRules),
      JSON.stringify(saved.data)
    );

    const reread = await api("GET", "/api/alert-rules", { token: adminToken });
    check("Saved rules persist for the workspace",
      JSON.stringify(reread.data?.rules) === JSON.stringify(customRules),
      JSON.stringify(reread.data && reread.data.rules));

    const customData = (await api("GET", "/api/insights", { token: adminToken })).data || {};
    check("The alert centre reports the saved rules (meta.rules)",
      JSON.stringify(customData.meta?.rules) === JSON.stringify(customRules),
      JSON.stringify(customData.meta && customData.meta.rules));

    const customBudget = customData.sections?.budget || [];
    check(
      "Saved budget rules change the tiers: 109.09% exceeded, 87.5% critical, 80% warning",
      customBudget.map((a) => `${a.meta.usagePercentage}|${a.meta.alertLevel}`).join(",") ===
        "109.09|exceeded,87.5|critical,80|warning" &&
        customBudget.map((a) => a.title).join("|") ===
          "Budget exceeded|Budget critical|Budget nearly exhausted" &&
        customBudget.filter((a) => a.severity === "critical").length === 2,
      JSON.stringify(customBudget.map((a) => [a.meta.usagePercentage, a.meta.alertLevel, a.severity]))
    );

    check(
      "Saved unusual rule (300% above average = 4x) removes the unusual alert",
      sectionLength(customData, "unusual") === 0 &&
        customData.meta.unusual.multiplier === 4 &&
        customData.meta.unusual.threshold === 3000 &&
        Boolean(findAlert(customData, "activity-no-unusual")),
      JSON.stringify(customData.meta.unusual)
    );

    const customTrend = findAlert(customData, "spending-month-trend");
    check(
      "Saved increase rule (500%) reports the +442.9% rise as below the alert level",
      customTrend && customTrend.severity === "info" &&
        customTrend.title === "Spending increase below alert level" &&
        customTrend.meta.crossesAlertThreshold === false &&
        customTrend.message.includes("500% alert level"),
      JSON.stringify(customTrend && customTrend.meta)
    );

    check(
      "Custom-rules summary matches the recomputed sections",
      customData.summary.total === 10 && customData.summary.critical === 2 &&
        customData.summary.warning === 1 && customData.summary.insight === 4 &&
        customData.summary.info === 3,
      JSON.stringify(customData.summary)
    );

    /* --- restoring the defaults brings the original alerts back ---------- */
    const restored = await api("PUT", "/api/alert-rules", {
      token: adminToken,
      body: DEFAULT_ALERT_RULES,
    });
    const afterRestore = (await api("GET", "/api/insights", { token: adminToken })).data || {};
    check(
      "Restoring the defaults reproduces the original alert set",
      restored.status === 200 && afterRestore.summary?.total === data.summary.total &&
        sectionLength(afterRestore, "unusual") === 1 &&
        JSON.stringify(afterRestore.meta?.rules) === JSON.stringify(DEFAULT_ALERT_RULES),
      JSON.stringify(afterRestore.summary)
    );
  } finally {
    await cleanup();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    console.log("\n  Cleanup: fixture workspaces removed, server closed.");
  }
};

main()
  .then(() => {
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("\n[FATAL]", error && (error.stack || error.message) || error);
    process.exit(1);
  });
