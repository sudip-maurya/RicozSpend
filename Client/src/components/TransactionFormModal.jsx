import { useState } from "react";

import { createTransaction, updateTransaction } from "../services/transactionService";
import { todayInputValue, toDateInputValue } from "../utils/format";
import "./../styles/transactions.css";

/**
 * Add / Edit transaction modal (Part 4).
 * Opened without `transaction` -> creates a new record (date defaults to today).
 * Opened with `transaction`    -> edits that record (PUT to its id).
 *
 * The parent gives this component a `key` per target transaction, so it is
 * always freshly initialised - no state-reset effect is needed.
 * Validation runs on submit; failed fields show inline messages.
 */
function TransactionFormModal({ transaction, facets = { categories: [], departments: [] }, onClose, onSaved }) {
  const isEdit = Boolean(transaction?.id);

  const [form, setForm] = useState(() => ({
    amount: transaction?.amount ?? "",
    vendor: transaction?.vendor ?? "",
    category: transaction?.category ?? "",
    department: transaction?.department ?? "",
    date: transaction ? toDateInputValue(transaction.date) : todayInputValue(),
    description: transaction?.description ?? "",
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

    if (String(form.amount).trim() === "") {
      nextErrors.amount = "Amount is required.";
    } else if (!Number.isFinite(amount)) {
      nextErrors.amount = "Amount must be a valid number.";
    } else if (amount <= 0) {
      nextErrors.amount = "Amount must be greater than 0.";
    }

    if (!form.vendor.trim()) nextErrors.vendor = "Vendor is required.";
    if (!form.category.trim()) nextErrors.category = "Category is required.";
    if (!form.department.trim()) nextErrors.department = "Cost centre / department is required.";

    if (!form.date) {
      nextErrors.date = "Date is required.";
    } else if (Number.isNaN(new Date(form.date).getTime())) {
      nextErrors.date = "Date must be a valid date.";
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
      amount: Number(form.amount),
      vendor: form.vendor.trim(),
      category: form.category.trim(),
      department: form.department.trim(),
      date: form.date,
      description: form.description.trim(),
    };

    const result = isEdit
      ? await updateTransaction(transaction.id, payload)
      : await createTransaction(payload);

    setIsSaving(false);

    if (result.error) {
      if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
      }
      setFormError(result.error);
      return;
    }

    onSaved(isEdit ? "Transaction updated successfully." : "Transaction created successfully.");
  };

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="transaction-form-title">
            {isEdit ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {formError && <p className="alert alert--error">{formError}</p>}

        <form className="txn-form" onSubmit={handleSubmit} noValidate>
          <div className="txn-form__row">
            <div className="form-field">
              <label className="form-field__label" htmlFor="txn-amount">
                Amount (INR) *
              </label>
              <input
                id="txn-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="75000"
              />
              {errors.amount && <span className="form-field__error">{errors.amount}</span>}
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="txn-date">
                Date *
              </label>
              <input
                id="txn-date"
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                disabled={isSaving}
              />
              {errors.date && <span className="form-field__error">{errors.date}</span>}
            </div>
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="txn-vendor">
              Vendor *
            </label>
            <input
              id="txn-vendor"
              name="vendor"
              type="text"
              value={form.vendor}
              onChange={handleChange}
              disabled={isSaving}
              placeholder="Dell Technologies"
            />
            {errors.vendor && <span className="form-field__error">{errors.vendor}</span>}
          </div>

          <div className="txn-form__row">
            <div className="form-field">
              <label className="form-field__label" htmlFor="txn-category">
                Category *
              </label>
              <input
                id="txn-category"
                name="category"
                type="text"
                value={form.category}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="IT"
                list="txn-category-options"
              />
              <datalist id="txn-category-options">
                {(facets?.categories || []).map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {errors.category && <span className="form-field__error">{errors.category}</span>}
            </div>

            <div className="form-field">
              <label className="form-field__label" htmlFor="txn-department">
                Cost Centre / Department *
              </label>
              <input
                id="txn-department"
                name="department"
                type="text"
                value={form.department}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="Technology"
                list="txn-department-options"
              />
              <datalist id="txn-department-options">
                {(facets?.departments || []).map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              {errors.department && (
                <span className="form-field__error">{errors.department}</span>
              )}
            </div>
          </div>

          <div className="form-field">
            <label className="form-field__label" htmlFor="txn-description">
              Description / Notes
            </label>
            <input
              id="txn-description"
              name="description"
              type="text"
              value={form.description}
              onChange={handleChange}
              disabled={isSaving}
              placeholder="5 laptops purchased"
            />
          </div>

          <p className="txn-form__hint">Fields marked * are required. Date defaults to today.</p>

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="submit" className="btn" disabled={isSaving}>
              {isSaving ? "Saving..." : isEdit ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TransactionFormModal;
