import { useState } from "react";

import { confirmCsvImport, previewCsvImport } from "../services/transactionService";
import { formatMoney } from "../utils/format";
import "./../styles/transactions.css";

const ACCEPT = ".csv,text/csv,text/plain";

/**
 * Import CSV modal (Part 5).
 *
 * Flow: choose file -> server preview (validate + duplicates, nothing saved)
 * -> confirm -> bulk import -> result summary. Nothing is imported until the
 * user explicitly confirms, and the server re-validates on confirm.
 */
function TransactionImportModal({ onClose, onImported }) {
  const [step, setStep] = useState("select"); // select | preview | done
  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const reset = () => {
    setStep("select");
    setFileName("");
    setCsv("");
    setPreview(null);
    setResult(null);
    setError("");
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isCsvLike =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.toLowerCase().endsWith(".csv");

    if (!isCsvLike) {
      setError("Please choose a .csv file.");
      event.target.value = "";
      return;
    }

    if (file.size === 0) {
      setError("That file is empty.");
      event.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("The file is too large. Please upload a file under 2 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setFileName(file.name);

    // Read as text; parsing/validation happens on the server.
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the file. Please try again.");
    reader.onload = () => {
      const csvText = String(reader.result || "");
      setCsv(csvText);
      runPreview(csvText);
    };
    reader.readAsText(file);

    // P2-8: clear the input so choosing the same file again re-triggers change.
    event.target.value = "";
  };

  const runPreview = async (csvText) => {
    setIsBusy(true);
    setError("");

    const { data, error: apiError } = await previewCsvImport(csvText);

    setIsBusy(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    setPreview(data);
  };

  const handleConfirm = async () => {
    if (isBusy) return; // prevent double submission

    setIsBusy(true);
    setError("");

    const { data, error: apiError } = await confirmCsvImport(csv);

    setIsBusy(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    setResult(data);
    setStep("done");
  };

  const statusBadge = (status) => (
    <span className={`import-status import-status--${status.toLowerCase()}`}>{status}</span>
  );

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="import-title">Import CSV</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        {error && <p className="alert alert--error">{error}</p>}

        {step === "select" && (
          <div className="import-select">
            <p className="card__text">
              Upload a CSV with the columns <strong>Amount, Vendor, Category, Department, Date</strong>{" "}
              and optional <strong>Description</strong>. Dates use <strong>DD/MM/YYYY</strong>.
            </p>
            <pre className="import-sample">
{`Amount,Vendor,Category,Department,Date,Description
75000,Dell Technologies,IT,Technology,23/09/2026,5 laptops purchased
28500,AWS,Software,Technology,22/09/2026,Cloud services`}
            </pre>

            <input type="file" accept={ACCEPT} onChange={handleFileChange} disabled={isBusy} />

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {step !== "done" && preview && (
          <div className="import-preview">
            <p className="txn-form__hint">File: {fileName}</p>

            {/* P2-4: the server ignores unrecognized columns - say so plainly. */}
            {preview.unknownColumns?.length > 0 && (
              <p className="txn-form__hint">
                Ignored unknown column{preview.unknownColumns.length === 1 ? "" : "s"}:{" "}
                {preview.unknownColumns.join(", ")}
              </p>
            )}

            <div className="import-summary">
              <div className="import-summary__item">
                <span className="import-summary__value">{preview.summary.totalRows}</span>
                <span className="import-summary__label">Total Rows</span>
              </div>
              <div className="import-summary__item import-summary__item--valid">
                <span className="import-summary__value">{preview.summary.valid}</span>
                <span className="import-summary__label">Valid</span>
              </div>
              <div className="import-summary__item import-summary__item--invalid">
                <span className="import-summary__value">{preview.summary.invalid}</span>
                <span className="import-summary__label">Invalid</span>
              </div>
              <div className="import-summary__item import-summary__item--duplicate">
                <span className="import-summary__value">{preview.summary.duplicates}</span>
                <span className="import-summary__label">Duplicates</span>
              </div>
            </div>

            <div className="txn-table-wrap import-preview__table">
              <table className="txn-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Department</th>
                    <th className="txn-table__amount">Amount</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((entry) => (
                    <tr key={entry.row}>
                      <td>{entry.row}</td>
                      <td>{entry.date}</td>
                      <td>{entry.vendor}</td>
                      <td>{entry.category}</td>
                      <td>{entry.department}</td>
                      <td className="txn-table__amount">{formatMoney(entry.amount)}</td>
                      <td>{statusBadge(entry.status)}</td>
                      <td>{entry.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal__actions">
              <button type="button" className="btn btn--ghost" onClick={reset}>
                Choose another file
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleConfirm}
                disabled={isBusy || preview.summary.valid === 0}
                title={
                  preview.summary.valid === 0
                    ? "No valid rows to import"
                    : undefined
                }
              >
                {isBusy
                  ? "Importing..."
                  : `Import ${preview.summary.valid} Transaction${preview.summary.valid === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="import-done">
            <p className="alert alert--success">
              {result.message}
              {result.invalidSkipped > 0 &&
                ` ${result.invalidSkipped} invalid row${result.invalidSkipped === 1 ? "" : "s"} skipped.`}
              {result.duplicateSkipped > 0 &&
                ` ${result.duplicateSkipped} duplicate row${result.duplicateSkipped === 1 ? "" : "s"} skipped.`}
            </p>

            <div className="modal__actions">
              <button type="button" className="btn" onClick={onImported}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TransactionImportModal;
