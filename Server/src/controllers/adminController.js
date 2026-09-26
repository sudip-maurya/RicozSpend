/**
 * Admin-only controllers (MVP - role foundation + Viewer user management).
 *
 * Every handler here runs behind `protect + requireRole("Admin")`
 * (see src/routes/adminRoutes.js), so a Viewer token answers 403 first.
 */

const User = require("../models/User");
const { ROLES, ROLE_VALUES } = User;
const {
  EMAIL_PATTERN,
  normalizeEmail,
  normalizeName,
  validateSignup,
} = require("../utils/validation");
const { spendScope } = require("../utils/spendScope");

const GENERIC_SERVER_ERROR = "Something went wrong. Please try again.";

/**
 * GET /api/admin/overview (protected + requireRole("Admin"))
 */
const getOverview = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const orgFilter = { organizationId: scope.organizationId };

    const [totalUsers, adminCount] = await Promise.all([
      User.countDocuments(orgFilter),
      User.countDocuments({ ...orgFilter, role: ROLES.ADMIN }),
    ]);

    return res.json({
      message: "Admin access granted.",
      overview: {
        totalUsers,
        adminCount,
        viewerCount: totalUsers - adminCount,
      },
      user: req.user.toSafeObject(),
    });
  } catch (error) {
    console.error("[admin] Failed to build overview:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/** Shape a user document for the Admin viewer list (never the password hash). */
const toManagedUser = (user) => {
  const safe = user.toSafeObject ? user.toSafeObject() : {};
  return {
    id: safe.id || String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    isEmailVerified: Boolean(user.isEmailVerified),
    // Missing (legacy) field means active.
    isActive: user.isActive !== false,
    status: user.isActive === false ? "Inactive" : "Active",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const isValidViewerRole = (role) => ROLE_VALUES.includes(role) && role === ROLES.VIEWER;
const isValidRole = (role) => ROLE_VALUES.includes(role);

/**
 * GET /api/admin/users (Admin only) - list Viewers + their account status.
 */
const listViewers = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const orgFilter = { organizationId: scope.organizationId };
    const includeAdmins = String(req.query.includeAdmins || "").toLowerCase() === "true";
    const filter = includeAdmins ? { ...orgFilter } : { ...orgFilter, role: ROLES.VIEWER };
    const users = await User.find(filter).sort({ createdAt: -1 });
    return res.json({ users: users.map(toManagedUser), total: users.length });
  } catch (error) {
    console.error("[admin] Failed to list users:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * POST /api/admin/users (Admin only) - create a Viewer (active immediately).
 */
const createViewer = async (req, res) => {
  const { name, email, password, role } = req.body || {};
  const { isValid, errors } = validateSignup({ name, email, password });
  if (!isValid) {
    return res.status(400).json({ message: "Please check the highlighted fields and try again.", errors });
  }
  if (role !== undefined && role !== null && String(role).trim() !== "" && role !== ROLES.VIEWER) {
    return res.status(400).json({
      message: `Only the "${ROLES.VIEWER}" role can be assigned here.`,
      errors: { role: `Role must be "${ROLES.VIEWER}".` },
    });
  }
  try {
    const cleanEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        errors: { email: "This email is already registered." },
      });
    }
    const scope = spendScope(req.user);
    const user = await User.create({
      name: normalizeName(name),
      email: cleanEmail,
      password,
      role: ROLES.VIEWER,
      organizationId: scope.organizationId,
      isEmailVerified: true,
      isActive: true,
    });
    return res.status(201).json({ message: "Viewer created successfully.", user: toManagedUser(user) });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        errors: { email: "This email is already registered." },
      });
    }
    console.error("[admin] Failed to create viewer:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/** Load a managed user by id (404 / 400 handled here). */
const findManagedUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: "User not found." });
      return null;
    }
    const scope = spendScope(req.user);
    const userOrg = user.organizationId || "ricozspend-default";
    if (userOrg !== scope.organizationId) {
      res.status(404).json({ message: "User not found." });
      return null;
    }
    return user;
  } catch (error) {
    res.status(400).json({ message: "Invalid user id." });
    return null;
  }
};

/** Admins cannot touch their own account or another Admin here. */
const blockedSelfOrAdmin = (req, res, user) => {
  if (String(user._id) === String(req.user._id)) {
    res.status(400).json({ message: "You cannot manage your own Admin account here." });
    return true;
  }
  if (user.role === ROLES.ADMIN) {
    res.status(400).json({ message: "Admin accounts cannot be managed here." });
    return true;
  }
  return false;
};

/**
 * PUT /api/admin/users/:id (Admin only) - edit Viewer name/email/role.
 */
const updateViewer = async (req, res) => {
  try {
    const user = await findManagedUser(req, res);
    if (!user) return;
    if (blockedSelfOrAdmin(req, res, user)) return;
    const { name, email, role } = req.body || {};
    const errors = {};
    if (name !== undefined) {
      const cleanName = normalizeName(name);
      if (cleanName.length < 2) errors.name = "Name must be at least 2 characters long.";
      else if (cleanName.length > 60) errors.name = "Name must be at most 60 characters long.";
      else user.name = cleanName;
    }
    if (email !== undefined) {
      const cleanEmail = normalizeEmail(email);
      if (!EMAIL_PATTERN.test(cleanEmail)) errors.email = "Please enter a valid email address.";
      else {
        const clash = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (clash) errors.email = "This email is already registered.";
        else user.email = cleanEmail;
      }
    }
    if (role !== undefined && role !== null && String(role).trim() !== "") {
      if (!isValidViewerRole(role)) errors.role = `Role must be "${ROLES.VIEWER}".`;
      else user.role = ROLES.VIEWER;
    }
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Please check the highlighted fields and try again.", errors });
    }
    await user.save();
    return res.json({ message: "Viewer updated successfully.", user: toManagedUser(user) });
  } catch (error) {
    console.error("[admin] Failed to update viewer:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * PATCH /api/admin/users/:id/status (Admin only) - activate/deactivate.
 */
const setViewerStatus = async (req, res) => {
  try {
    const user = await findManagedUser(req, res);
    if (!user) return;
    if (blockedSelfOrAdmin(req, res, user)) return;
    const { isActive } = req.body || {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "A valid status is required.",
        errors: { isActive: "isActive must be true (activate) or false (deactivate)." },
      });
    }
    user.isActive = isActive;
    await user.save();
    return res.json({
      message: isActive ? "Viewer activated successfully." : "Viewer deactivated successfully.",
      user: toManagedUser(user),
    });
  } catch (error) {
    console.error("[admin] Failed to change viewer status:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * DELETE /api/admin/users/:id (Admin only) - delete a Viewer.
 */
const deleteViewer = async (req, res) => {
  try {
    const user = await findManagedUser(req, res);
    if (!user) return;
    if (blockedSelfOrAdmin(req, res, user)) return;
    await user.deleteOne();
    return res.json({ message: "Viewer deleted successfully." });
  } catch (error) {
    console.error("[admin] Failed to delete viewer:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/* =========================================================================
 * ADMIN MANAGEMENT CONTROLLERS
 * Dedicated endpoints:
 *   GET    /api/admin/admins
 *   POST   /api/admin/admins
 *   PUT    /api/admin/admins/:id
 *   PATCH  /api/admin/admins/:id/status
 *   DELETE /api/admin/admins/:id
 * ========================================================================= */

/** Count active Admins in a specific workspace. */
const countActiveAdminsInOrg = async (organizationId) => {
  return User.countDocuments({
    organizationId,
    role: ROLES.ADMIN,
    isActive: { $ne: false },
  });
};

/**
 * GET /api/admin/admins (Admin only) - list Admin accounts in workspace.
 */
const listAdmins = async (req, res) => {
  try {
    const scope = spendScope(req.user);
    const filter = { organizationId: scope.organizationId, role: ROLES.ADMIN };
    const admins = await User.find(filter).sort({ createdAt: -1 });
    return res.json({ admins: admins.map(toManagedUser), total: admins.length });
  } catch (error) {
    console.error("[admin] Failed to list admins:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * POST /api/admin/admins (Admin only) - create an Admin account (active + email verified immediately).
 */
const createAdminUser = async (req, res) => {
  const { name, email, password, role } = req.body || {};
  const { isValid, errors } = validateSignup({ name, email, password });
  if (!isValid) {
    return res.status(400).json({ message: "Please check the highlighted fields and try again.", errors });
  }
  if (role !== undefined && role !== null && String(role).trim() !== "" && role !== ROLES.ADMIN) {
    return res.status(400).json({
      message: `Only the "${ROLES.ADMIN}" role can be assigned here.`,
      errors: { role: `Role must be "${ROLES.ADMIN}".` },
    });
  }
  try {
    const cleanEmail = normalizeEmail(email);
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        errors: { email: "This email is already registered." },
      });
    }
    const scope = spendScope(req.user);
    const admin = await User.create({
      name: normalizeName(name),
      email: cleanEmail,
      password,
      role: ROLES.ADMIN,
      organizationId: scope.organizationId,
      isEmailVerified: true,
      isActive: true,
    });
    return res.status(201).json({ message: "Admin created successfully.", admin: toManagedUser(admin) });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        errors: { email: "This email is already registered." },
      });
    }
    console.error("[admin] Failed to create admin:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/** Load a managed Admin user by id (404 / 400 handled here). */
const findManagedAdmin = async (req, res) => {
  const user = await findManagedUser(req, res);
  if (!user) return null;
  if (user.role !== ROLES.ADMIN) {
    res.status(400).json({ message: "This user is not an Admin account." });
    return null;
  }
  return user;
};

/**
 * PUT /api/admin/admins/:id (Admin only) - edit Admin name/email/role.
 */
const updateAdminUser = async (req, res) => {
  try {
    const admin = await findManagedAdmin(req, res);
    if (!admin) return;

    const { name, email, role } = req.body || {};
    const errors = {};

    if (name !== undefined) {
      const cleanName = normalizeName(name);
      if (cleanName.length < 2) errors.name = "Name must be at least 2 characters long.";
      else if (cleanName.length > 60) errors.name = "Name must be at most 60 characters long.";
      else admin.name = cleanName;
    }

    if (email !== undefined) {
      const cleanEmail = normalizeEmail(email);
      if (!EMAIL_PATTERN.test(cleanEmail)) {
        errors.email = "Please enter a valid email address.";
      } else {
        const clash = await User.findOne({ email: cleanEmail, _id: { $ne: admin._id } });
        if (clash) errors.email = "This email is already registered.";
        else admin.email = cleanEmail;
      }
    }

    if (role !== undefined && role !== null && String(role).trim() !== "") {
      if (!isValidRole(role)) {
        errors.role = `Role must be "${ROLES.ADMIN}" or "${ROLES.VIEWER}".`;
      } else if (role !== admin.role) {
        // Demoting an Admin to Viewer: check guardrails
        if (String(admin._id) === String(req.user._id)) {
          return res.status(400).json({ message: "You cannot demote your own Admin account." });
        }
        const activeCount = await countActiveAdminsInOrg(admin.organizationId || "ricozspend-default");
        if (activeCount <= 1) {
          return res.status(400).json({
            message: "Cannot demote the last active Admin in the organization.",
          });
        }
        admin.role = role;
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Please check the highlighted fields and try again.", errors });
    }

    await admin.save();
    return res.json({ message: "Admin updated successfully.", admin: toManagedUser(admin) });
  } catch (error) {
    console.error("[admin] Failed to update admin:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * PATCH /api/admin/admins/:id/status (Admin only) - activate/deactivate an Admin.
 * Guardrails:
 *  - Cannot deactivate own account.
 *  - Cannot deactivate the last active Admin in the organization.
 */
const setAdminStatus = async (req, res) => {
  try {
    const admin = await findManagedAdmin(req, res);
    if (!admin) return;

    const { isActive } = req.body || {};
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "A valid status is required.",
        errors: { isActive: "isActive must be true (activate) or false (deactivate)." },
      });
    }

    if (!isActive) {
      if (String(admin._id) === String(req.user._id)) {
        return res.status(400).json({ message: "You cannot deactivate your own Admin account." });
      }
      const activeCount = await countActiveAdminsInOrg(admin.organizationId || "ricozspend-default");
      if (activeCount <= 1) {
        return res.status(400).json({
          message: "Cannot deactivate the last active Admin in the organization.",
        });
      }
    }

    admin.isActive = isActive;
    await admin.save();
    return res.json({
      message: isActive ? "Admin activated successfully." : "Admin deactivated successfully.",
      admin: toManagedUser(admin),
    });
  } catch (error) {
    console.error("[admin] Failed to change admin status:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

/**
 * DELETE /api/admin/admins/:id (Admin only) - delete an Admin account.
 * Guardrails:
 *  - Cannot delete own account.
 *  - Cannot delete the last active Admin in the organization.
 */
const deleteAdminUser = async (req, res) => {
  try {
    const admin = await findManagedAdmin(req, res);
    if (!admin) return;

    if (String(admin._id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot delete your own Admin account." });
    }

    const activeCount = await countActiveAdminsInOrg(admin.organizationId || "ricozspend-default");
    if (activeCount <= 1 && admin.isActive !== false) {
      return res.status(400).json({
        message: "Cannot delete the last active Admin in the organization.",
      });
    }

    await admin.deleteOne();
    return res.json({ message: "Admin deleted successfully." });
  } catch (error) {
    console.error("[admin] Failed to delete admin:", error.message);
    return res.status(500).json({ message: GENERIC_SERVER_ERROR });
  }
};

module.exports = {
  getOverview,
  listViewers,
  createViewer,
  updateViewer,
  setViewerStatus,
  deleteViewer,
  // Admin management
  listAdmins,
  createAdminUser,
  updateAdminUser,
  setAdminStatus,
  deleteAdminUser,
};
