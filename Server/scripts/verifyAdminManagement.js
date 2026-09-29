/** Admin Management verification - /api/admin/admins end to end. */

const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

// P3-3: these scripts write/delete data - refuse to run against production unless explicitly forced
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("Refusing to run this verification script with NODE_ENV=production (pass --force to override).");
  process.exit(1);
}

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const { signToken } = require("../src/utils/token");

const { ROLES } = User;

const PORT = Number(process.env.VERIFY_ADMINS_PORT || 5097);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const RUN_ID = Date.now();
const ORG_PREFIX = "part16-verify-";
const ORG = `${ORG_PREFIX}${RUN_ID}`;
const OTHER_ORG = `${ORG}-other`;
const ORG_QUERY = { organizationId: { $regex: `^${ORG_PREFIX}` } };
const TEST_PASSWORD = "Part16Verify!";

let passed = 0;
const failures = [];

/** Print PASS/FAIL and remember failures for the exit code. */
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

/** Small fetch wrapper: JSON in, JSON out, never throws on 4xx/5xx. */
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

/** Create a fixture account in one of the temporary workspaces. */
const makeUser = (name, email, role, organizationId) =>
  User.create({
    name,
    email,
    password: TEST_PASSWORD,
    role,
    isEmailVerified: true,
    organizationId,
  });

const cleanup = () => User.deleteMany(ORG_QUERY);


const main = async () => {
  console.log("RicozSpend Part 16 - Admin Management verification");
  console.log(`Target: ${BASE_URL} (isolated workspace: ${ORG})`);

  await connectDB();
  const server = await new Promise((resolve) => {
    const instance = app.listen(PORT, () => resolve(instance));
  });

  try {
    // ------------------------------------------------------------- fixtures
    section("Fixtures (isolated workspace)");
    const admin = await makeUser("Part16 Admin", `part16.admin.${RUN_ID}@ricozspend.test`, ROLES.ADMIN, ORG);
    const viewer = await makeUser("Part16 Viewer", `part16.viewer.${RUN_ID}@ricozspend.test`, ROLES.VIEWER, ORG);
    const otherAdmin = await makeUser("Part16 Other Admin", `part16.other.${RUN_ID}@ricozspend.test`, ROLES.ADMIN, OTHER_ORG);

    const adminToken = signToken(admin);
    const viewerToken = signToken(viewer);
    const otherAdminToken = signToken(otherAdmin);
    console.log(`  Seeded 1 Admin + 1 Viewer in ${ORG} and 1 Admin in ${OTHER_ORG}`);

    // ----------------------------------------------------------------- list
    section("1. List Admins (workspace-scoped)");
    const listRes = await api("GET", "/api/admin/admins", { token: adminToken });
    check("GET /api/admin/admins answers 200 for Admin", listRes.status === 200, listRes.status);
    check("The list only carries this workspace's Admin", listRes.data?.total === 1, JSON.stringify(listRes.data));
    check("The listed account is the signed-in Admin", listRes.data?.admins?.[0]?.email === admin.email);
    check("The list never leaks a password hash", (listRes.data?.admins || []).every((entry) => !("password" in entry)));
    check(
      "Listed Admin reports role/status/isActive",
      listRes.data?.admins?.[0]?.role === ROLES.ADMIN &&
        listRes.data?.admins?.[0]?.status === "Active" &&
        listRes.data?.admins?.[0]?.isActive === true,
      JSON.stringify(listRes.data?.admins?.[0])
    );
    check("The other workspace's Admin is not visible", !(listRes.data?.admins || []).some((entry) => entry.email === otherAdmin.email));

    const viewerListRes = await api("GET", "/api/admin/admins", { token: viewerToken });
    check("2. Viewer on the Admin list answers 403", viewerListRes.status === 403, viewerListRes.status);

    const anonymousListRes = await api("GET", "/api/admin/admins");
    check("   Anonymous call to the Admin list answers 401", anonymousListRes.status === 401, anonymousListRes.status);


    // --------------------------------------------------------------- create
    section("3. Create Admin (validated, hashed, verified)");
    const newEmail = `part16.newadmin.${RUN_ID}@ricozspend.test`;
    const createRes = await api("POST", "/api/admin/admins", {
      token: adminToken,
      body: { name: "Part16 New Admin", email: newEmail, password: TEST_PASSWORD },
    });
    check("POST /api/admin/admins answers 201", createRes.status === 201, JSON.stringify(createRes.data));
    check("The created account carries the Admin role", createRes.data?.admin?.role === ROLES.ADMIN, createRes.data?.admin?.role);
    check(
      "The created Admin starts active and email-verified",
      createRes.data?.admin?.isActive === true && createRes.data?.admin?.isEmailVerified === true,
      JSON.stringify(createRes.data?.admin)
    );
    check("The create response never leaks the password", createRes.data?.admin && !("password" in createRes.data.admin));

    const secondAdminId = createRes.data?.admin?.id;
    const stored = await User.findOne({ email: newEmail }).select("+password");
    check("The password is stored as a bcrypt hash", Boolean(stored) && stored.password !== TEST_PASSWORD, stored?.password?.slice(0, 7));
    check("bcrypt.compare(plain, stored) is true", Boolean(stored) && (await bcrypt.compare(TEST_PASSWORD, stored.password)));
    check("The new Admin joins the caller's workspace", stored?.organizationId === ORG, stored?.organizationId);
    check(
      "Admins are appended, not merged (list now shows two)",
      (await api("GET", "/api/admin/admins", { token: adminToken })).data?.total === 2
    );

    const weakPasswordRes = await api("POST", "/api/admin/admins", {
      token: adminToken,
      body: { name: "Weak Admin", email: `part16.weak.${RUN_ID}@ricozspend.test`, password: "123" },
    });
    check("A weak password is rejected with 400", weakPasswordRes.status === 400, weakPasswordRes.status);
    check("The weak-password error names the field", typeof weakPasswordRes.data?.errors?.password === "string", JSON.stringify(weakPasswordRes.data));

    const duplicateRes = await api("POST", "/api/admin/admins", {
      token: adminToken,
      body: { name: "Duplicate Admin", email: admin.email, password: TEST_PASSWORD },
    });
    check("A duplicate email is rejected with 409", duplicateRes.status === 409, duplicateRes.status);

    const viewerCreateRes = await api("POST", "/api/admin/admins", {
      token: viewerToken,
      body: { name: "Sneaky Admin", email: `part16.sneaky.${RUN_ID}@ricozspend.test`, password: TEST_PASSWORD },
    });
    check("A Viewer creating an Admin answers 403", viewerCreateRes.status === 403, viewerCreateRes.status);
    check(
      "The blocked Viewer created no account",
      (await User.findOne({ email: `part16.sneaky.${RUN_ID}@ricozspend.test` })) === null
    );


    // ----------------------------------------------------------------- edit
    section("4. Edit Admin (name / email validation)");
    const renameRes = await api("PUT", `/api/admin/admins/${secondAdminId}`, {
      token: adminToken,
      body: { name: "Part16 Renamed Admin" },
    });
    check("PUT /api/admin/admins/:id answers 200", renameRes.status === 200, `${renameRes.status}: ${JSON.stringify(renameRes.data)}`);
    check("The new name is persisted", renameRes.data?.admin?.name === "Part16 Renamed Admin", renameRes.data?.admin?.name);
    check(
      "The rename did not touch the role",
      renameRes.data?.admin?.role === ROLES.ADMIN,
      renameRes.data?.admin?.role
    );

    const invalidEmailRes = await api("PUT", `/api/admin/admins/${secondAdminId}`, {
      token: adminToken,
      body: { email: "not-an-email" },
    });
    check("An invalid email is rejected with 400", invalidEmailRes.status === 400, invalidEmailRes.status);

    const emailClashRes = await api("PUT", `/api/admin/admins/${secondAdminId}`, {
      token: adminToken,
      body: { email: viewer.email },
    });
    check("An email clash with an existing account is rejected with 400", emailClashRes.status === 400, emailClashRes.status);

    const ownEmailRes = await api("PUT", `/api/admin/admins/${secondAdminId}`, {
      token: adminToken,
      body: { email: newEmail },
    });
    check("Keeping the same email is allowed (no false clash)", ownEmailRes.status === 200, ownEmailRes.status);

    const viewerEditRes = await api("PUT", `/api/admin/admins/${secondAdminId}`, {
      token: viewerToken,
      body: { name: "Viewer Edit" },
    });
    check("A Viewer editing an Admin answers 403", viewerEditRes.status === 403, viewerEditRes.status);

    const unknownIdRes = await api("PUT", "/api/admin/admins/000000000000000000000000", {
      token: adminToken,
      body: { name: "Ghost" },
    });
    check("An unknown Admin id answers 404", unknownIdRes.status === 404, unknownIdRes.status);

    // ------------------------------------------------------- status rules
    section("5. Status guardrails (self + last active Admin)");
    const selfDeactivateRes = await api("PATCH", `/api/admin/admins/${admin._id}/status`, {
      token: adminToken,
      body: { isActive: false },
    });
    check("An Admin cannot deactivate their own account (400)", selfDeactivateRes.status === 400, JSON.stringify(selfDeactivateRes.data));
    check(
      "The self-deactivation message is explicit",
      /your own admin account/i.test(selfDeactivateRes.data?.message || ""),
      selfDeactivateRes.data?.message
    );

    const badStatusRes = await api("PATCH", `/api/admin/admins/${secondAdminId}/status`, {
      token: adminToken,
      body: { isActive: "nope" },
    });
    check("A non-boolean status is rejected with 400", badStatusRes.status === 400, badStatusRes.status);

    const deactivateSecondRes = await api("PATCH", `/api/admin/admins/${secondAdminId}/status`, {
      token: adminToken,
      body: { isActive: false },
    });
    check("A second Admin can be deactivated (200)", deactivateSecondRes.status === 200, `${deactivateSecondRes.status}: ${JSON.stringify(deactivateSecondRes.data)}`);
    check("The deactivated Admin reports Inactive", deactivateSecondRes.data?.admin?.isActive === false && deactivateSecondRes.data?.admin?.status === "Inactive");

    const deactivatedLoginUser = await User.findOne({ email: newEmail });
    check("Deactivation is persisted", deactivatedLoginUser?.isActive === false);

    const lastAdminRes = await api("PATCH", `/api/admin/admins/${secondAdminId}/status`, {
      token: otherAdminToken,
      body: { isActive: false },
    });
    check("A foreign Admin cannot reach this workspace's account (404)", lastAdminRes.status === 404, lastAdminRes.status);


    const reactivateRes = await api("PATCH", `/api/admin/admins/${secondAdminId}/status`, {
      token: adminToken,
      body: { isActive: true },
    });
    check("A deactivated Admin can be reactivated (200)", reactivateRes.status === 200, reactivateRes.status);
    check(
      "The reactivation message + status are reported",
      /activated/i.test(reactivateRes.data?.message || "") && reactivateRes.data?.admin?.status === "Active",
      JSON.stringify(reactivateRes.data)
    );

    // --------------------------------------------------------------- delete
    section("6. Delete Admins");
    const selfDeleteRes = await api("DELETE", `/api/admin/admins/${admin._id}`, { token: adminToken });
    check("An Admin cannot delete their own account (400)", selfDeleteRes.status === 400, JSON.stringify(selfDeleteRes.data));
    check(
      "The self-deletion message is explicit",
      /your own admin account/i.test(selfDeleteRes.data?.message || ""),
      selfDeleteRes.data?.message
    );
    check("The signed-in Admin still exists after the blocked delete", (await User.findById(admin._id)) !== null);

    const viewerDeleteRes = await api("DELETE", `/api/admin/admins/${secondAdminId}`, { token: viewerToken });
    check("A Viewer deleting an Admin answers 403", viewerDeleteRes.status === 403, viewerDeleteRes.status);

    const unknownDeleteRes = await api("DELETE", "/api/admin/admins/000000000000000000000000", { token: adminToken });
    check("Deleting an unknown Admin id answers 404", unknownDeleteRes.status === 404, unknownDeleteRes.status);

    const deleteSecondRes = await api("DELETE", `/api/admin/admins/${secondAdminId}`, { token: adminToken });
    check("Another Admin can be deleted (200)", deleteSecondRes.status === 200, `${deleteSecondRes.status}: ${JSON.stringify(deleteSecondRes.data)}`);
    check("The deleted account is gone from the database", (await User.findById(secondAdminId)) === null);
    check(
      "The workspace is back to a single Admin",
      (await api("GET", "/api/admin/admins", { token: adminToken })).data?.total === 1
    );

    // ------------------------------------------- single-Active-Admin rules
    section("7. Workspace with one active Admin");
    const soloOrg = `${ORG}-solo`;
    const soloAdmin = await makeUser("Part16 Solo Admin", `part16.solo.${RUN_ID}@ricozspend.test`, ROLES.ADMIN, soloOrg);
    const soloInactive = await makeUser("Part16 Solo Inactive", `part16.soloinactive.${RUN_ID}@ricozspend.test`, ROLES.ADMIN, soloOrg);
    soloInactive.isActive = false;
    await soloInactive.save();
    const soloToken = signToken(soloAdmin);

    check(
      "The solo workspace lists both Admins",
      (await api("GET", "/api/admin/admins", { token: soloToken })).data?.total === 2
    );
    const soloSelfDeactivate = await api("PATCH", `/api/admin/admins/${soloAdmin._id}/status`, {
      token: soloToken,
      body: { isActive: false },
    });
    check("The only active Admin cannot deactivate themselves (400)", soloSelfDeactivate.status === 400, soloSelfDeactivate.status);
    const soloSelfDelete = await api("DELETE", `/api/admin/admins/${soloAdmin._id}`, { token: soloToken });
    check("The only active Admin cannot delete themselves (400)", soloSelfDelete.status === 400, soloSelfDelete.status);
    const soloDeleteInactive = await api("DELETE", `/api/admin/admins/${soloInactive._id}`, { token: soloToken });
    check(
      "Deleting an INACTIVE Admin is still allowed for the last active Admin (200)",
      soloDeleteInactive.status === 200,
      `${soloDeleteInactive.status}: ${JSON.stringify(soloDeleteInactive.data)}`
    );
    check("The solo Admin is still active afterwards", (await User.findById(soloAdmin._id))?.isActive !== false);


    // --------------------------------------- last-active guard (source)
    section("8. Last-active-Admin guard exists in the controller");
    const controllerSource = fs.readFileSync(path.join(__dirname, "..", "src", "controllers", "adminController.js"), "utf8");
    check(
      "The delete handler refuses to remove the last active Admin",
      controllerSource.includes("Cannot delete the last active Admin in the organization."),
      "message missing from adminController.js"
    );
    check(
      "The status handler refuses to deactivate the last active Admin",
      controllerSource.includes("Cannot deactivate the last active Admin in the organization."),
      "message missing from adminController.js"
    );
    check(
      "Both handlers count only active Admins of the workspace",
      controllerSource.includes("countActiveAdminsInOrg") && controllerSource.includes("isActive: { $ne: false }"),
      "active-Admin counter missing"
    );
    check(
      "The self-delete / self-deactivate guards are present",
      controllerSource.includes("You cannot delete your own Admin account.") &&
        controllerSource.includes("You cannot deactivate your own Admin account."),
      "self guard messages missing"
    );
    check(
      "Admin endpoints never take the workspace from the request",
      controllerSource.includes("const scope = spendScope(req.user);") && !controllerSource.includes("req.body.organizationId"),
      "workspace scope not taken from req.user"
    );

    // -------------------------------------------------------- isolation
    section("9. Workspace isolation");
    const otherListRes = await api("GET", "/api/admin/admins", { token: otherAdminToken });
    check(
      "The other workspace still lists exactly its own Admin",
      otherListRes.status === 200 && otherListRes.data?.total === 1 && otherListRes.data?.admins?.[0]?.email === otherAdmin.email,
      JSON.stringify(otherListRes.data)
    );
    const crossEditRes = await api("PUT", `/api/admin/admins/${admin._id}`, {
      token: otherAdminToken,
      body: { name: "Cross Workspace Edit" },
    });
    check("Editing a foreign workspace's Admin answers 404", crossEditRes.status === 404, crossEditRes.status);
    const crossStatusRes = await api("PATCH", `/api/admin/admins/${admin._id}/status`, {
      token: otherAdminToken,
      body: { isActive: false },
    });
    check("Toggling a foreign workspace's Admin answers 404", crossStatusRes.status === 404, crossStatusRes.status);
    const crossDeleteRes = await api("DELETE", `/api/admin/admins/${admin._id}`, { token: otherAdminToken });
    check("Deleting a foreign workspace's Admin answers 404", crossDeleteRes.status === 404, crossDeleteRes.status);
    check("The foreign workspace never touched this Admin", (await User.findById(admin._id))?.name === "Part16 Admin");

    // -------------------------------------------------------- regression
    section("10. Regression: Viewer endpoints + overview");
    const viewerListRes2 = await api("GET", "/api/admin/users", { token: adminToken });
    check("GET /api/admin/users still answers 200", viewerListRes2.status === 200, viewerListRes2.status);
    check(
      "The Viewer list still contains the fixture Viewer",
      (viewerListRes2.data?.users || []).some((entry) => entry.email === viewer.email),
      JSON.stringify(viewerListRes2.data)
    );
    check(
      "The Viewer list stays free of Admin accounts",
      (viewerListRes2.data?.users || []).every((entry) => entry.role === ROLES.VIEWER)
    );

    const adminOnViewerRouteRes = await api("PUT", `/api/admin/users/${admin._id}`, {
      token: adminToken,
      body: { name: "Should Not Work" },
    });
    check(
      "The legacy Viewer route refuses the caller's own Admin account (400)",
      adminOnViewerRouteRes.status === 400 && /your own admin account/i.test(adminOnViewerRouteRes.data?.message || ""),
      `${adminOnViewerRouteRes.status}: ${adminOnViewerRouteRes.data?.message}`
    );

    // A different Admin account must still be refused by the Viewer routes (400).
    const legacyProbe = await api("POST", "/api/admin/admins", {
      token: adminToken,
      body: {
        name: "Part16 Legacy Probe",
        email: `part16.legacy.${RUN_ID}@ricozspend.test`,
        password: TEST_PASSWORD,
      },
    });
    const legacyProbeId = legacyProbe.data?.admin?.id;
    const otherAdminOnViewerRouteRes = await api("PUT", `/api/admin/users/${legacyProbeId}`, {
      token: adminToken,
      body: { name: "Should Not Work" },
    });
    check(
      "The legacy Viewer route still refuses other Admin accounts (400)",
      otherAdminOnViewerRouteRes.status === 400 &&
        /Admin accounts cannot be managed here/i.test(otherAdminOnViewerRouteRes.data?.message || ""),
      `${otherAdminOnViewerRouteRes.status}: ${otherAdminOnViewerRouteRes.data?.message}`
    );
    const legacyProbeDelete = await api("DELETE", `/api/admin/admins/${legacyProbeId}`, { token: adminToken });
    check("The legacy probe Admin was removed again (200)", legacyProbeDelete.status === 200, legacyProbeDelete.status);

    const overviewRes = await api("GET", "/api/admin/overview", { token: adminToken });
    check("GET /api/admin/overview still answers 200", overviewRes.status === 200, overviewRes.status);
    check(
      "The overview counts the workspace users (1 Admin + 1 Viewer)",
      overviewRes.data?.overview?.adminCount === 1 && overviewRes.data?.overview?.viewerCount === 1,
      JSON.stringify(overviewRes.data?.overview)
    );


    // ----------------------------------------------------------- summary
    section("Result");
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failures.length}`);
    if (failures.length) {
      failures.forEach((label) => console.log(`   - ${label}`));
    }
  } finally {
    await cleanup();
    console.log("\n  Cleanup: temporary workspaces removed, server closed.");
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }

  process.exit(failures.length ? 1 : 0);
};

main().catch(async (error) => {
  console.error("\nVerification crashed:", error);
  try {
    await cleanup();
  } catch {
    // cleanup is best-effort
  }
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
