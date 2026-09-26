import { useState } from "react";

import { createBudget, updateBudget } from "../services/budgetService";
import "../styles/transactions.css";

const PERIOD_PATTERN = /^(19|20)\d{2}-(0[1-9]|1[0-2])$/;

/**
 * Add / Edit budget modal (Part 9 - Budget vs Actual).
 * Opened without `budget` -> creates a new budget. Opened with a comparison row
 * -> edits that budget (PUT to its id).
 *
 * Admin only: the parent mounts it for Admins and the backend also enforces
 * requireRole("Admin") with HTTP 403 for Viewers.
 * The parent gives this component a `key` per target, so it is always freshly
 * initialised - no state-reset effect is needed.
 */
function BudgetFormModal({ budget, facets = { departments: [], categories: [] }, onClose, onSaved }) {
  const isEdit = Boolean(budget?.id);

  const [form, setForm] = useState(() => ({
    department: budget?.department ?? "",
    category: budget?.category ?? "",
    // Comparison rows expose the planned amount as `budget`.
    amount: budget && Number.isFinite(budget.budget) ? budget.budget : "",
    period: budget?.period ?? "",
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    const amount = Number(form.amount);

    if (!form.department.trim()) {
      nextErrors.department = "Cost centre / department is required.";
    }

    if (String(form.amount).trim() === "") {
      nextErrors.amount = "Budget amount is required.";
    } else if (!Number.isFinite(amount)) {
      nextErrors.amount = "Budget amount must be a valid number.";
    } else if (amount <= 0) {
      nextErrors.amount = "Budget amount must be greater than 0.";
    }

    if (!form.period.trim()) {
      nextErrors.period = "Budget period is required.";
    } else if (!PERIOD_PATTERN.test(form.period.trim())) {
      nextErrors.period = "Budget period must be a valid month (YYYY-MM).";
    }

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return; // prevent invalid submissions

    setIsSaving(true);
    setFormError("");

    const payload = {
      department: form.department.trim(),
      category: form.category.trim(),
      amount: Number(form.amount),
      period: form.period.trim(),
    };

    const result = isEdit ? await updateBudget(budget.id, payload) : await createBudget(payload);

    setIsSaving(false);

    if (result.error) {
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
      }
      setFormError(result.error);
      return;
    }

    onSaved(isEdit ? "Budget updated successfully." : "Budget created successfully.");
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="budget-form-title">{isEdit ? "Edit Budget" : "Add Budget"}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {formError && <p className="alert alert--error">{formError}</p>}

        <form className="txn-form" onSubmit={handleSubmit} noValidate>
          <div className="txn-form__row">
            <div className="form-field">
              <label className="form-field__label" htmlFor="budget-form-department">
                Cost Centre / Department *
              </label>
              <input
                id="budget-form-department"
                name="department"
                type="text"
                value={form.department}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="Technology"
                list="budget-form-department-options"
              />
              <datalist id="budget-form-department-options">
                {(facets?.departments || []).map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {errors.department && <span className="form-field__error">{errors.department}</span>}
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="budget-form-category">
                Category (optional)
              </label>
              <input
                id="budget-form-category"
                name="category"
                type="text"
                value={form.category}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="IT"
                list="budget-form-category-options"
              />
              <datalist id="budget-form-category-options">
                {(facets?.categories || []).map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {errors.category && <span className="form-field__error">{errors.category}</span>}
            </div>
          </div>

          <div className="txn-form__row">
            <div className="form-field">
              <label className="form-field__label" htmlFor="budget-form-amount">
                Budget Amount (INR) *
              </label>
              <input
                id="budget-form-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="500000"
              />
              {errors.amount && <span className="form-field__error">{errors.amount}</span>}
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="budget-form-period">
                Month / Period *
              </label>
              <input
                id="budget-form-period"
                name="period"
                type="month"
                value={form.period}
                onChange={handleChange}
                disabled={isSaving}
              />
              {errors.period && <span className="form-field__error">{errors.period}</span>}
            </div>
          </div>

          <p className="txn-form__hint">
            Fields marked * are required. Leave the category blank to budget the whole cost centre.
          </p>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={isSaving}>
              {isSaving ? "Saving..." : isEdit ? "Save changes" : "Add budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BudgetFormModal;

