import { useEffect, useState } from "react";

import NavBar from "../components/NavBar";
import { useAuth } from "../context/authContext";
import {
  createAdmin,
  createViewer,
  deleteAdmin,
  deleteViewer,
  fetchAdminOverview,
  fetchAdmins,
  fetchViewers,
  setAdminStatus,
  setViewerStatus,
  updateAdmin,
  updateViewer,
} from "../services/adminService";
import { getErrorMessage, getFieldErrors, getStatusCode } from "../utils/apiError";
import "../styles/transactions.css";

/**
 * Admin page (overview + Viewer + Admin user management).
 * Reached only by Admins (ProtectedRoute) and backed by Admin-only APIs,
 * which answer 403 for a Viewer token even if this page were reachable.
 */
function AdminOverview() {
  const { user } = useAuth();

  const [overview, setOverview] = useState(null);
  const [viewers, setViewers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [adminListError, setAdminListError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isAdminListLoading, setIsAdminListLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Add / edit form state (reuses existing form-field/alert/btn styles).
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "" });
  const [editErrors, setEditErrors] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Admin add / edit form state (mirrors the Viewer controls above).
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "" });
  const [adminFormErrors, setAdminFormErrors] = useState({});
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [adminEditingId, setAdminEditingId] = useState(null);
  const [adminEditForm, setAdminEditForm] = useState({ name: "", email: "" });
  const [adminEditErrors, setAdminEditErrors] = useState({});
  const [adminBusyId, setAdminBusyId] = useState(null);
  const [adminDeleteTarget, setAdminDeleteTarget] = useState(null);

  const showToast = (message) => {
    setToast(message);
    if (showToast.timer) clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    let isActive = true;

    const loadOverview = async () => {
      try {
        const { data } = await fetchAdminOverview();

        if (!isActive) return;

        setOverview(data?.overview ?? null);
      } catch (requestError) {
        if (!isActive) return;

        setError(
          getStatusCode(requestError) === 403
            ? "You do not have permission to view this area."
            : getErrorMessage(requestError, "Unable to load the admin overview.")
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadOverview();

    return () => {
      isActive = false;
    };
  }, []);

  // Loader used by the admin actions (create/edit/delete/restore). The mount
  // effect below keeps its own guarded copy, because react-hooks/
  // set-state-in-effect rejects calling a component-scope loader from an effect.
  const loadViewers = async () => {
    setIsListLoading(true);
    setListError("");
    try {
      const { data } = await fetchViewers();
      setViewers(Array.isArray(data?.users) ? data.users : []);
    } catch (requestError) {
      setViewers([]);
      setListError(
        getStatusCode(requestError) === 403
          ? "You do not have permission to view this area."
          : getErrorMessage(requestError, "Unable to load viewers.")
      );
    } finally {
      setIsListLoading(false);
    }
  };

  const loadAdmins = async () => {
    setIsAdminListLoading(true);
    setAdminListError("");
    try {
      const { data } = await fetchAdmins();
      setAdmins(Array.isArray(data?.admins) ? data.admins : []);
    } catch (requestError) {
      setAdmins([]);
      setAdminListError(
        getStatusCode(requestError) === 403
          ? "You do not have permission to view this area."
          : getErrorMessage(requestError, "Unable to load admins.")
      );
    } finally {
      setIsAdminListLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsListLoading(true);
      setIsAdminListLoading(true);
      setListError("");
      setAdminListError("");

      try {
        const [viewerRes, adminRes] = await Promise.all([fetchViewers(), fetchAdmins()]);

        if (!isActive) return;
        setViewers(Array.isArray(viewerRes.data?.users) ? viewerRes.data.users : []);
        setAdmins(Array.isArray(adminRes.data?.admins) ? adminRes.data.admins : []);
      } catch (requestError) {
        if (!isActive) return;

        setViewers([]);
        setAdmins([]);
        const message =
          getStatusCode(requestError) === 403
            ? "You do not have permission to view this area."
            : getErrorMessage(requestError, "Unable to load users.");
        setListError(message);
        setAdminListError(message);
      } finally {
        if (isActive) {
          setIsListLoading(false);
          setIsAdminListLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, []);

  /** P2-7: client-side validation mirroring the server's signup rules. */
  const validateCreateForm = (form) => {
    const errors = {};
    if (!form.name.trim()) errors.name = "Name is required.";
    if (!form.email.trim()) {
      errors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (!form.password) {
      errors.password = "Password is required.";
    } else if (form.password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    return errors;
  };

  const handleCreateViewer = async (event) => {
    event.preventDefault();
    const fieldErrors = validateCreateForm(form);
    if (Object.keys(fieldErrors).length > 0) {
      setFormErrors(fieldErrors);
      return;
    }
    setFormErrors({});
    setIsSaving(true);
    try {
      const { data } = await createViewer({ ...form, role: "Viewer" });
      setForm({ name: "", email: "", password: "" });
      showToast(data?.message || "Viewer created successfully.");
      await loadViewers();
    } catch (requestError) {
      setFormErrors(getFieldErrors(requestError));
      showToast(getErrorMessage(requestError, "Could not create the viewer."));
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (viewer) => {
    setEditingId(viewer.id);
    setEditErrors({});
    setEditForm({ name: viewer.name || "", email: viewer.email || "" });
    setDeleteTarget(null);
  };

  const handleUpdateViewer = async (event) => {
    event.preventDefault();
    if (!editingId) return;
    setEditErrors({});
    setBusyId(editingId);
    try {
      const { data } = await updateViewer(editingId, { ...editForm, role: "Viewer" });
      showToast(data?.message || "Viewer updated successfully.");
      setEditingId(null);
      await loadViewers();
    } catch (requestError) {
      setEditErrors(getFieldErrors(requestError));
      showToast(getErrorMessage(requestError, "Could not update the viewer."));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleStatus = async (viewer) => {
    const nextActive = !(viewer.isActive !== false);
    setBusyId(viewer.id);
    try {
      const { data } = await setViewerStatus(viewer.id, nextActive);
      showToast(data?.message || (nextActive ? "Viewer activated." : "Viewer deactivated."));
      await loadViewers();
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "Could not change the viewer status."));
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteViewer = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const { data } = await deleteViewer(deleteTarget.id);
      showToast(data?.message || "Viewer deleted successfully.");
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) setEditingId(null);
      await Promise.all([loadViewers(), loadAdmins()]);
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "Could not delete the viewer."));
    } finally {
      setBusyId(null);
    }
  };

  const startAdminEdit = (admin) => {
    setAdminEditingId(admin.id);
    setAdminEditErrors({});
    setAdminEditForm({ name: admin.name || "", email: admin.email || "" });
    setAdminDeleteTarget(null);
  };

  const handleCreateAdmin = async (event) => {
    event.preventDefault();
    const fieldErrors = validateCreateForm(adminForm);
    if (Object.keys(fieldErrors).length > 0) {
      setAdminFormErrors(fieldErrors);
      return;
    }
    setAdminFormErrors({});
    setIsAdminSaving(true);
    try {
      const { data } = await createAdmin({ ...adminForm, role: "Admin" });
      setAdminForm({ name: "", email: "", password: "" });
      showToast(data?.message || "Admin created successfully.");
      await Promise.all([loadAdmins(), loadViewers()]);
    } catch (requestError) {
      setAdminFormErrors(getFieldErrors(requestError));
      showToast(getErrorMessage(requestError, "Could not create the admin."));
    } finally {
      setIsAdminSaving(false);
    }
  };

  const handleUpdateAdmin = async (event) => {
    event.preventDefault();
    if (!adminEditingId) return;
    setAdminEditErrors({});
    setAdminBusyId(adminEditingId);
    try {
      const { data } = await updateAdmin(adminEditingId, { ...adminEditForm });
      showToast(data?.message || "Admin updated successfully.");
      setAdminEditingId(null);
      await loadAdmins();
    } catch (requestError) {
      setAdminEditErrors(getFieldErrors(requestError));
      showToast(getErrorMessage(requestError, "Could not update the admin."));
    } finally {
      setAdminBusyId(null);
    }
  };

  const handleToggleAdminStatus = async (admin) => {
    const nextActive = !(admin.isActive !== false);
    setAdminBusyId(admin.id);
    try {
      const { data } = await setAdminStatus(admin.id, nextActive);
      showToast(data?.message || (nextActive ? "Admin activated." : "Admin deactivated."));
      await loadAdmins();
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "Could not change the admin status."));
    } finally {
      setAdminBusyId(null);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!adminDeleteTarget) return;
    setAdminBusyId(adminDeleteTarget.id);
    try {
      const { data } = await deleteAdmin(adminDeleteTarget.id);
      showToast(data?.message || "Admin deleted successfully.");
      setAdminDeleteTarget(null);
      if (adminEditingId === adminDeleteTarget.id) setAdminEditingId(null);
      await loadAdmins();
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "Could not delete the admin."));
    } finally {
      setAdminBusyId(null);
    }
  };

  const isSelfAdmin = (admin) => {
    if (!admin || !user) return false;
    if (admin.id && user.id) return String(admin.id) === String(user.id);
    return admin.email && user.email
      ? String(admin.email).toLowerCase() === String(user.email).toLowerCase()
      : false;
  };

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <h1 className="page-title">Admin overview</h1>
        <p className="page-subtitle">Only accounts with the Admin role can load this data.</p>

        {error && <p className="alert alert--error">{error}</p>}

        <section className="card">
          <h2>Users</h2>

          {isLoading && !error && <p className="card__text">Loading admin data...</p>}

          {!isLoading && !error && (
            <dl className="info-list">
              <div>
                <dt>Total users</dt>
                <dd>{overview?.totalUsers ?? 0}</dd>
              </div>
              <div>
                <dt>Admins</dt>
                <dd>{overview?.adminCount ?? 0}</dd>
              </div>
              <div>
                <dt>Viewers</dt>
                <dd>{overview?.viewerCount ?? 0}</dd>
              </div>
            </dl>
          )}
        </section>

        {toast && <p className="alert alert--success">{toast}</p>}

        <section className="card">
          <h2>Add Viewer</h2>
          <form className="txn-form" onSubmit={handleCreateViewer} noValidate>
            <div className="txn-form__row">
              <div className="form-field">
                <label className="form-field__label" htmlFor="viewer-name">Name *</label>
                <input
                  id="viewer-name"
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={isSaving}
                  placeholder="Viewer name"
                />
                {formErrors.name && <span className="form-field__error">{formErrors.name}</span>}
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="viewer-email">Email *</label>
                <input
                  id="viewer-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  disabled={isSaving}
                  placeholder="viewer@company.com"
                />
                {formErrors.email && <span className="form-field__error">{formErrors.email}</span>}
              </div>
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="viewer-password">Password *</label>
              <input
                id="viewer-password"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                disabled={isSaving}
                placeholder="At least 6 characters"
              />
              {formErrors.password && <span className="form-field__error">{formErrors.password}</span>}
            </div>
            <div className="modal__actions">
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? "Creating..." : "Create Viewer"}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Viewers</h2>
          {isListLoading && <p className="card__text">Loading viewers...</p>}
          {!isListLoading && listError && <p className="alert alert--error">{listError}</p>}
          {!isListLoading && !listError && viewers.length === 0 && (
            <p className="card__text">No viewers found.</p>
          )}
          {!isListLoading && !listError && viewers.length > 0 && (
            <div className="txn-table-wrap">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {viewers.map((viewer) => (
                    <ViewerRow
                      key={viewer.id}
                      viewer={viewer}
                      busy={busyId === viewer.id}
                      editing={editingId === viewer.id}
                      editForm={editForm}
                      editErrors={editErrors}
                      confirmingDelete={deleteTarget?.id === viewer.id}
                      onEditFormChange={setEditForm}
                      onStartEdit={() => startEdit(viewer)}
                      onCancelEdit={() => setEditingId(null)}
                      onSaveEdit={handleUpdateViewer}
                      onToggleStatus={() => handleToggleStatus(viewer)}
                      onAskDelete={() => setDeleteTarget(viewer)}
                      onCancelDelete={() => setDeleteTarget(null)}
                      onConfirmDelete={handleDeleteViewer}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Add Admin</h2>
          <p className="card__text">
            Admins can manage every account in this workspace. A new Admin is active
            immediately and never receives a verification email.
          </p>
          <form className="txn-form" onSubmit={handleCreateAdmin} noValidate>
            <div className="txn-form__row">
              <div className="form-field">
                <label className="form-field__label" htmlFor="admin-name">Name *</label>
                <input
                  id="admin-name"
                  type="text"
                  value={adminForm.name}
                  onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))}
                  disabled={isAdminSaving}
                  placeholder="Admin name"
                />
                {adminFormErrors.name && <span className="form-field__error">{adminFormErrors.name}</span>}
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="admin-email">Email *</label>
                <input
                  id="admin-email"
                  type="email"
                  value={adminForm.email}
                  onChange={(event) => setAdminForm((current) => ({ ...current, email: event.target.value }))}
                  disabled={isAdminSaving}
                  placeholder="admin@company.com"
                />
                {adminFormErrors.email && <span className="form-field__error">{adminFormErrors.email}</span>}
              </div>
            </div>
            <div className="form-field">
              <label className="form-field__label" htmlFor="admin-password">Password *</label>
              <input
                id="admin-password"
                type="password"
                value={adminForm.password}
                onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))}
                disabled={isAdminSaving}
                placeholder="At least 6 characters"
              />
              {adminFormErrors.password && <span className="form-field__error">{adminFormErrors.password}</span>}
            </div>
            <div className="modal__actions">
              <button type="submit" className="btn" disabled={isAdminSaving}>
                {isAdminSaving ? "Creating..." : "Create Admin"}
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2>Admins</h2>
          {isAdminListLoading && <p className="card__text">Loading admins...</p>}
          {!isAdminListLoading && adminListError && <p className="alert alert--error">{adminListError}</p>}
          {!isAdminListLoading && !adminListError && admins.length === 0 && (
            <p className="card__text">No admins found.</p>
          )}
          {!isAdminListLoading && !adminListError && admins.length > 0 && (
            <div className="txn-table-wrap">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => (
                    <AdminRow
                      key={admin.id}
                      admin={admin}
                      isSelf={isSelfAdmin(admin)}
                      busy={adminBusyId === admin.id}
                      editing={adminEditingId === admin.id}
                      editForm={adminEditForm}
                      editErrors={adminEditErrors}
                      confirmingDelete={adminDeleteTarget?.id === admin.id}
                      onEditFormChange={setAdminEditForm}
                      onStartEdit={() => startAdminEdit(admin)}
                      onCancelEdit={() => setAdminEditingId(null)}
                      onSaveEdit={handleUpdateAdmin}
                      onToggleStatus={() => handleToggleAdminStatus(admin)}
                      onAskDelete={() => setAdminDeleteTarget(admin)}
                      onCancelDelete={() => setAdminDeleteTarget(null)}
                      onConfirmDelete={handleDeleteAdmin}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card card--muted">
          <h2>Requested by</h2>
          <p className="card__text">
            {user?.email}{" "}
            <span className={`role-badge role-badge--${String(user?.role || "").toLowerCase()}`}>
              {user?.role}
            </span>
          </p>
          <p className="card__text">
            This data comes from the Admin-only endpoint <code>/api/admin/overview</code>, which
            answers 403 for a Viewer token.
          </p>
        </section>
      </main>
    </div>
  );
}

/**
 * One Viewer row: either read-only with Edit/Activate/Delete, or inline edit.
 * Uses only existing card/table/btn/form-field/import-status styles.
 */
function ViewerRow({
  viewer,
  busy,
  editing,
  editForm,
  editErrors,
  confirmingDelete,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleStatus,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  const active = viewer.isActive !== false;
  if (editing) {
    return (
      <tr>
        <td>
          <input
            className="txn-search"
            type="text"
            value={editForm.name}
            onChange={(event) => onEditFormChange((current) => ({ ...current, name: event.target.value }))}
            disabled={busy}
            aria-label="Viewer name"
          />
          {editErrors.name && <span className="form-field__error">{editErrors.name}</span>}
        </td>
        <td>
          <input
            className="txn-search"
            type="email"
            value={editForm.email}
            onChange={(event) => onEditFormChange((current) => ({ ...current, email: event.target.value }))}
            disabled={busy}
            aria-label="Viewer email"
          />
          {editErrors.email && <span className="form-field__error">{editErrors.email}</span>}
        </td>
        <td>{viewer.role}</td>
        <td>{viewer.status || (active ? "Active" : "Inactive")}</td>
        <td>
          <span className="txn-table__actions">
            <button type="button" className="btn" onClick={onSaveEdit} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancelEdit} disabled={busy}>
              Cancel
            </button>
          </span>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td>{viewer.name}</td>
      <td>{viewer.email}</td>
      <td>{viewer.role}</td>
      <td>
        <span className={`import-status ${active ? "import-status--valid" : "import-status--invalid"}`}>
          {viewer.status || (active ? "Active" : "Inactive")}
        </span>
      </td>
      <td>
        {confirmingDelete ? (
          <span className="txn-table__actions">
            <button type="button" className="btn btn--danger" onClick={onConfirmDelete} disabled={busy}>
              {busy ? "Deleting..." : "Yes, delete"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancelDelete} disabled={busy}>
              No
            </button>
          </span>
        ) : (
          <span className="txn-table__actions">
            <button type="button" className="btn btn--ghost" onClick={onStartEdit} disabled={busy}>
              Edit
            </button>
            <button type="button" className="btn btn--ghost" onClick={onToggleStatus} disabled={busy}>
              {active ? "Deactivate" : "Activate"}
            </button>
            <button type="button" className="btn btn--danger" onClick={onAskDelete} disabled={busy}>
              Delete
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

/**
 * One Admin row: either read-only with Edit/Activate/Delete, or inline edit.
 * The signed-in Admin is labelled "(you)"; self deactivate/delete is blocked
 * by disabling the buttons (the backend returns 400 as a second guard).
 */
function AdminRow({
  admin,
  isSelf,
  busy,
  editing,
  editForm,
  editErrors,
  confirmingDelete,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleStatus,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  const active = admin.isActive !== false;
  if (editing) {
    return (
      <tr>
        <td>
          <input
            className="txn-search"
            type="text"
            value={editForm.name}
            onChange={(event) => onEditFormChange((current) => ({ ...current, name: event.target.value }))}
            disabled={busy}
            aria-label="Admin name"
          />
          {editErrors.name && <span className="form-field__error">{editErrors.name}</span>}
        </td>
        <td>
          <input
            className="txn-search"
            type="email"
            value={editForm.email}
            onChange={(event) => onEditFormChange((current) => ({ ...current, email: event.target.value }))}
            disabled={busy}
            aria-label="Admin email"
          />
          {editErrors.email && <span className="form-field__error">{editErrors.email}</span>}
        </td>
        <td>{admin.role}</td>
        <td>{admin.status || (active ? "Active" : "Inactive")}</td>
        <td>
          <span className="txn-table__actions">
            <button type="button" className="btn" onClick={onSaveEdit} disabled={busy}>
              {busy ? "Saving..." : "Save"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancelEdit} disabled={busy}>
              Cancel
            </button>
          </span>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td>
        {admin.name}
        {isSelf && " (you)"}
      </td>
      <td>{admin.email}</td>
      <td>{admin.role}</td>
      <td>
        <span className={`import-status ${active ? "import-status--valid" : "import-status--invalid"}`}>
          {admin.status || (active ? "Active" : "Inactive")}
        </span>
      </td>
      <td>
        {confirmingDelete ? (
          <span className="txn-table__actions">
            <button type="button" className="btn btn--danger" onClick={onConfirmDelete} disabled={busy || isSelf}>
              {busy ? "Deleting..." : "Yes, delete"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onCancelDelete} disabled={busy}>
              No
            </button>
          </span>
        ) : (
          <span className="txn-table__actions">
            <button type="button" className="btn btn--ghost" onClick={onStartEdit} disabled={busy}>
              Edit
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onToggleStatus}
              disabled={busy || (isSelf && active)}
              title={isSelf && active ? "You cannot deactivate your own Admin account." : undefined}
            >
              {active ? "Deactivate" : "Activate"}
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={onAskDelete}
              disabled={busy || isSelf}
              title={isSelf ? "You cannot delete your own Admin account." : undefined}
            >
              Delete
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}

export default AdminOverview;
