import { useEffect, useState } from "react";

import { fetchAlertRules, updateAlertRules } from "../services/alertRulesService";
import { formatDateTime } from "../utils/format";

/**
 * Alert Rules editor - the configuration
 * UI itself is unchanged).
 *
 * Edits the five percentage thresholds the Alerts & Insights system uses
 * (budget warning / critical / exceeded, unusual spending, spending increase).
 * Values are read from and saved to the database through GET/PUT
 * /api/alert-rules, which is Admin-only: the parent only mounts this editor for
 * Admin accounts, Viewers keep read-only access to the alerts themselves, and
 * the backend answers 403 for /api/alert-rules regardless.
 *
 * The editable metadata (labels, units, ranges) comes from the API, so the
 * form can never drift from the server-side rules. Validation mirrors the
 * backend so an Admin gets instant feedback; the server still validates
 * everything again on save.
 *
 * `onSaved` (optional) runs after a successful save so the parent can refresh
 * the alerts it displays with the new thresholds.
 */

/** Percentage parsing that accepts the string coming from a number input. */
const toNumber = (value) => {
  const text = String(value ?? "").trim();
  return text ? Number(text) : Number.NaN;
};

/**
 * Mirrors validateAlertRules() in Server/src/utils/alertRules.js so the form
 * can reject invalid input before the round-trip.
 */
const validateRulesForm = (form, fields) => {
  const errors = {};
  const values = {};

  fields.forEach(({ key, label, min, max }) => {
    const raw = String(form[key] ?? "").trim();

    if (!raw) {
      errors[key] = `${label} is required.`;
      return;
    }

    const value = toNumber(raw);

    if (!Number.isFinite(value)) {
      errors[key] = `${label} must be a number.`;
      return;
    }

    if (value < min || value > max) {
      errors[key] = `${label} must be between ${min} and ${max}.`;
      return;
    }

    values[key] = value;
  });

  const { budgetWarning, budgetCritical, budgetExceeded } = values;

  if (
    Number.isFinite(budgetWarning) &&
    Number.isFinite(budgetCritical) &&
    budgetCritical <= budgetWarning
  ) {
    errors.budgetCritical = "Budget Critical must be greater than Budget Warning.";
  }

  if (
    Number.isFinite(budgetCritical) &&
    Number.isFinite(budgetExceeded) &&
    budgetExceeded < budgetCritical
  ) {
    errors.budgetExceeded = "Budget Exceeded must be greater than or equal to Budget Critical.";
  }

  return { isValid: Object.keys(errors).length === 0, errors, values };
};

/** Server rules -> controlled form values (strings for the number inputs). */
const formFromRules = (rules) =>
  Object.fromEntries(Object.entries(rules || {}).map(([key, value]) => [key, String(value)]));

/** Admin-only Alert Rules editor. */
function AlertRulesEditor({ onSaved }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Same in-effect async + isActive guard pattern as the other pages.
  useEffect(() => {
    let isActive = true;

    const load = async () => {
      setIsLoading(true);
      setLoadError("");

      const result = await fetchAlertRules();

      if (!isActive) return;

      if (result.error) {
        setData(null);
        setLoadError(result.error);
      } else {
        setData(result.data);
        setForm(formFromRules(result.data?.rules));
        setErrors({});
      }

      setIsLoading(false);
    };

    load();

    return () => {
      isActive = false;
    };
  }, [reloadKey]);

  const fields = data?.fields || [];
  const activeRules = data?.rules || {};

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => (current[key] ? { ...current, [key]: "" } : current));
    setFormError("");
    setNotice("");
  };

  const handleRestoreDefaults = () => {
    setForm(formFromRules(data?.defaults));
    setErrors({});
    setFormError("");
    setNotice("Defaults filled in - click Save to apply them.");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateRulesForm(form, fields);

    if (!validation.isValid) {
      setErrors(validation.errors);
      setFormError("Please correct the highlighted alert rules.");
      setNotice("");
      return;
    }

    setIsSaving(true);
    setFormError("");

    const result = await updateAlertRules(validation.values);

    if (result.error) {
      setErrors(result.fieldErrors || {});
      setFormError(result.error);
      setNotice("");
    } else {
      setData(result.data);
      setForm(formFromRules(result.data?.rules));
      setErrors({});
      setNotice(result.data?.message || "Alert rules saved.");
      if (onSaved) onSaved();
    }

    setIsSaving(false);
  };

  return (
    <>
      <div className="alerts-head">
        <h2>Alert Rules</h2>
        <span className="alerts-badge">Admin only</span>
      </div>
      <p className="card__text">
        These percentages drive every alert in the Alerts &amp; Insights Center. Alerts are
        recalculated from your existing transactions and budgets, so a saved change takes
        effect immediately. Viewers can read the alerts but cannot change
        these rules.
      </p>

      {isLoading && <p className="dashboard-loading">Loading alert rules&hellip;</p>}

      {!isLoading && loadError && (
        <div className="dashboard-alert alerts-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !loadError && data && (
        <>
          <div className="alerts-summary" aria-label="Active alert rules">
            {fields.map((field) => (
              <div className="alerts-summary__item" key={`active-${field.key}`}>
                <span className="alerts-summary__label">{field.label}</span>
                <span className="alerts-summary__value">
                  {activeRules[field.key]}
                  {field.unit === "%" ? "%" : ""}
                </span>
              </div>
            ))}
            <div className="alerts-summary__item">
              <span className="alerts-summary__label">Source</span>
              <span className="alerts-summary__value">
                {data.isCustom ? "Saved" : "Defaults"}
              </span>
            </div>
          </div>

          {data.updatedAt && (
            <p className="card__text">Last saved {formatDateTime(data.updatedAt)}.</p>
          )}

          {formError && (
            <p className="alert alert--error" role="alert">
              {formError}
            </p>
          )}

          {notice && (
            <p className="alert alert--success" role="status">
              {notice}
            </p>
          )}

          <form className="txn-form" onSubmit={handleSubmit} noValidate>
            <div className="txn-form__row">
              {fields.map((field) => (
                <div className="form-field" key={field.key}>
                  <label className="form-field__label" htmlFor={`alert-rule-${field.key}`}>
                    {field.label} ({field.unit})
                  </label>
                  <input
                    id={`alert-rule-${field.key}`}
                    name={field.key}
                    type="number"
                    inputMode="decimal"
                    min={field.min}
                    max={field.max}
                    step="1"
                    value={form[field.key] ?? ""}
                    onChange={(event) => handleChange(field.key, event.target.value)}
                    disabled={isSaving}
                    aria-describedby={`alert-rule-${field.key}-help`}
                  />
                  <span className="txn-form__hint" id={`alert-rule-${field.key}-help`}>
                    {field.description} Allowed: {field.min}-{field.max}
                    {field.unit === "%" ? "%" : ` ${field.unit}`}.
                  </span>
                  {errors[field.key] && (
                    <span className="form-field__error">{errors[field.key]}</span>
                  )}
                </div>
              ))}
            </div>

            <p className="txn-form__hint">
              Budget Critical must be greater than Budget Warning, and Budget Exceeded must be
              at least Budget Critical.
            </p>

            <div className="modal__actions">
              <button type="submit" className="btn btn--primary" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save alert rules"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={handleRestoreDefaults}
                disabled={isSaving}
              >
                Restore defaults
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
}

export default AlertRulesEditor;
