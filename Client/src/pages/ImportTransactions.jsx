import { useRef, useState } from "react";
import { Link } from "react-router-dom";

import NavBar from "../components/NavBar";
import { useAuth } from "../context/authContext";
import { confirmCsvImport, previewCsvImport } from "../services/transactionService";
import { formatMoney } from "../utils/format";
import "../styles/transactions.css";
import "../styles/import.css";

const ACCEPT = ".csv,text/csv,text/plain";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

/** Redesigned Import Transactions page (CSV import). */
function ImportTransactions() {
  const { isAdmin } = useAuth();
  const fileInputRef = useRef(null);

  // Steps: "upload" (1) | "review" (2) | "imported" (3)
  const [step, setStep] = useState("upload");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [filterTab, setFilterTab] = useState("all"); // "all" | "valid" | "duplicate" | "invalid"
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setFileSize(0);
    setCsv("");
    setPreview(null);
    setResult(null);
    setFilterTab("all");
    setError("");
    setIsBusy(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownloadTemplate = () => {
    const templateContent =
      "Amount,Vendor,Category,Department,Date,Description\n" +
      "45000,Delta Airlines,Travel,Sales,18/09/2026,Client visit\n" +
      "12000,Staples,Office Supplies,Operations,20/09/2026,Stationery\n" +
      "75000,Dell Technologies,IT,Technology,23/09/2026,Laptops purchased\n";

    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ricozspend_import_template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const processFile = (file) => {
    if (!file) return;

    const isCsvLike =
      file.type === "text/csv" ||
      file.type === "application/vnd.ms-excel" ||
      file.name.toLowerCase().endsWith(".csv");

    if (!isCsvLike) {
      setError("Please choose a valid .csv file.");
      return;
    }

    if (file.size === 0) {
      setError("That file is empty.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("The file is too large. Please upload a file under 2 MB.");
      return;
    }

    setError("");
    setFileName(file.name);
    setFileSize(file.size);

    const reader = new FileReader();
    reader.onerror = () => setError("Could not read the file. Please try again.");
    reader.onload = () => {
      const csvText = String(reader.result || "");
      setCsv(csvText);
      runPreview(csvText);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
    // Allow re-uploading the same file
    event.target.value = "";
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      processFile(file);
    }
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
    setStep("review");
    setFilterTab("all");
  };

  const handleConfirmImport = async () => {
    if (isBusy || !preview || preview.summary.valid === 0) return;

    setIsBusy(true);
    setError("");

    const { data, error: apiError } = await confirmCsvImport(csv);

    setIsBusy(false);

    if (apiError) {
      setError(apiError);
      return;
    }

    setResult(data);
    setStep("imported");
  };

  // Filter preview rows by selected tab
  const rows = preview?.rows || [];
  const filteredRows = rows.filter((item) => {
    if (filterTab === "valid") return item.status === "Valid";
    if (filterTab === "duplicate") return item.status === "Duplicate";
    if (filterTab === "invalid") return item.status === "Invalid";
    return true; // "all"
  });

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="import-page">
          {/* 1. PAGE HEADER */}
          <header className="import-header">
            <div>
              <h1 className="import-header__title">Import Transactions</h1>
              <p className="import-header__subtitle">
                Upload your spending data in bulk and review it before adding anything to RicozSpend.
              </p>
            </div>
            <div className="import-header__actions">
              <Link to="/transactions" className="btn btn--primary">
                View Transactions
              </Link>
            </div>
          </header>

          {/* 2. STEP INDICATOR */}
          <nav className="import-stepper" aria-label="Import progress">
            <div
              className={`import-step ${
                step === "upload" ? "import-step--active" : ""
              }`}
            >
              <span className="import-step__dot">
                {step === "upload" ? "●" : "○"}
              </span>
              <span>1 Upload</span>
            </div>

            <div className="import-step__divider" aria-hidden="true" />

            <div
              className={`import-step ${
                step === "review" ? "import-step--active" : ""
              }`}
            >
              <span className="import-step__dot">
                {step === "review" ? "●" : "○"}
              </span>
              <span>2 Review</span>
            </div>

            <div className="import-step__divider" aria-hidden="true" />

            <div
              className={`import-step ${
                step === "imported" ? "import-step--active" : ""
              }`}
            >
              <span className="import-step__dot">
                {step === "imported" ? "●" : "○"}
              </span>
              <span>3 Import</span>
            </div>
          </nav>

          {/* ERROR ALERT */}
          {error && (
            <div className="dashboard-alert alerts-error" role="alert" style={{ marginBottom: 20 }}>
              <span>{error}</span>
              <button type="button" className="btn btn--ghost" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}

          {/* VIEWER NOTICE */}
          {!isAdmin && (
            <section className="import-card" aria-label="Viewer notice">
              <div className="import-card__head">
                <h2 className="import-card__title">Read-only account</h2>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleDownloadTemplate}
                >
                  Download CSV Template
                </button>
              </div>
              <p className="card__text">
                Your account has the Viewer role, which is read-only. You can download the CSV template
                or view transactions, but importing records is limited to Admin accounts.
              </p>
            </section>
          )}

          {/* ADMIN: STEP 1 - UPLOAD CARD */}
          {isAdmin && step === "upload" && (
            <section className="import-card" aria-label="Upload CSV">
              <div className="import-card__head">
                <h2 className="import-card__title">Upload CSV File</h2>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleDownloadTemplate}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 6 }}
                    aria-hidden="true"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download CSV Template
                </button>
              </div>

              {/* Drag and Drop Zone */}
              <div
                className={`import-dropzone ${isDragging ? "is-dragging" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="import-dropzone__icon" aria-hidden="true">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>

                <p className="import-dropzone__title">
                  Drop your CSV file here
                </p>

                <button
                  type="button"
                  className="import-dropzone__browse-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse files
                </button>

                <p className="import-dropzone__limit">
                  CSV &bull; Maximum 2 MB &bull; Up to 5,000 rows
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
              </div>

              {/* 4. CSV REQUIREMENTS */}
              <div className="import-requirements">
                <span className="import-requirements__title">CSV Format Requirements</span>
                <div className="import-requirements__grid">
                  <div className="import-requirement-item">
                    <span className="import-requirement-item__bullet" aria-hidden="true">&bull;</span>
                    <span>
                      <strong>Required columns:</strong> Amount &middot; Vendor &middot; Category &middot; Department &middot; Date
                    </span>
                  </div>
                  <div className="import-requirement-item">
                    <span className="import-requirement-item__bullet" aria-hidden="true">&bull;</span>
                    <span>
                      <strong>Date formats:</strong> DD/MM/YYYY or YYYY-MM-DD
                    </span>
                  </div>
                  <div className="import-requirement-item">
                    <span className="import-requirement-item__bullet" aria-hidden="true">&bull;</span>
                    <span>
                      <strong>Amount:</strong> Must be greater than ₹0
                    </span>
                  </div>
                  <div className="import-requirement-item">
                    <span className="import-requirement-item__bullet" aria-hidden="true">&bull;</span>
                    <span>
                      <strong>Duplicate handling:</strong> Existing transactions are never overwritten
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ADMIN: STEP 2 - PREVIEW STAGE (PAGE HERO) */}
          {isAdmin && step === "review" && preview && (
            <>
              {/* 5. SELECTED FILE STATE CARD */}
              <div className="import-file-card">
                <div className="import-file-info">
                  <div className="import-file-icon" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div className="import-file-meta">
                    <span className="import-file-name">{fileName}</span>
                    <span className="import-file-sub">
                      <span>{formatBytes(fileSize)}</span>
                      <span>&bull;</span>
                      <span>{preview.summary.totalRows} detected rows</span>
                      <span>&bull;</span>
                      <span className="import-file-ready">✓ File ready to review</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="import-file-remove"
                  onClick={reset}
                  title="Remove file and choose another"
                  aria-label="Remove file"
                >
                  &times;
                </button>
              </div>

              {/* 6. PREVIEW HERO CARD */}
              <section className="import-preview-hero" aria-label="Review import data">
                <div className="import-preview-head">
                  <div>
                    <h2 className="import-preview-title">Review Import</h2>
                    <p className="import-preview-subtitle">
                      Verify transaction validity and duplicates before committing them to RicozSpend.
                    </p>
                  </div>

                  {preview.unknownColumns?.length > 0 && (
                    <span className="import-actions-bar__notice">
                      Ignored unrecognized columns: {preview.unknownColumns.join(", ")}
                    </span>
                  )}
                </div>

                {/* 4 Stat Boxes (Live Counts) */}
                <div className="import-stats-grid">
                  <div className="import-stat-box">
                    <span className="import-stat-box__label">Total Rows</span>
                    <span className="import-stat-box__value">
                      {preview.summary.totalRows.toLocaleString()}
                    </span>
                  </div>

                  <div className="import-stat-box import-stat-box--valid">
                    <span className="import-stat-box__label">Valid</span>
                    <span className="import-stat-box__value">
                      {preview.summary.valid.toLocaleString()}
                    </span>
                  </div>

                  <div className="import-stat-box import-stat-box--duplicate">
                    <span className="import-stat-box__label">Duplicates</span>
                    <span className="import-stat-box__value">
                      {preview.summary.duplicates.toLocaleString()}
                    </span>
                  </div>

                  <div className="import-stat-box import-stat-box--invalid">
                    <span className="import-stat-box__label">Invalid</span>
                    <span className="import-stat-box__value">
                      {preview.summary.invalid.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="import-tabs-row">
                  <div className="import-tabs" role="tablist" aria-label="Filter preview rows">
                    <button
                      type="button"
                      className={`import-tab-btn ${filterTab === "all" ? "is-active" : ""}`}
                      onClick={() => setFilterTab("all")}
                      role="tab"
                      aria-selected={filterTab === "all"}
                    >
                      All ({preview.summary.totalRows})
                    </button>
                    <button
                      type="button"
                      className={`import-tab-btn ${filterTab === "valid" ? "is-active" : ""}`}
                      onClick={() => setFilterTab("valid")}
                      role="tab"
                      aria-selected={filterTab === "valid"}
                    >
                      Valid ({preview.summary.valid})
                    </button>
                    <button
                      type="button"
                      className={`import-tab-btn ${filterTab === "duplicate" ? "is-active" : ""}`}
                      onClick={() => setFilterTab("duplicate")}
                      role="tab"
                      aria-selected={filterTab === "duplicate"}
                    >
                      Duplicates ({preview.summary.duplicates})
                    </button>
                    <button
                      type="button"
                      className={`import-tab-btn ${filterTab === "invalid" ? "is-active" : ""}`}
                      onClick={() => setFilterTab("invalid")}
                      role="tab"
                      aria-selected={filterTab === "invalid"}
                    >
                      Invalid ({preview.summary.invalid})
                    </button>
                  </div>

                  <span className="import-actions-bar__notice">
                    Showing {filteredRows.length} of {rows.length} rows
                  </span>
                </div>

                {/* Preview Table */}
                <div className="import-table-wrap">
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Vendor</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th>Category</th>
                        <th>Department</th>
                        <th>Date</th>
                        <th>Notes / Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: "center", padding: "24px", color: "var(--muted)" }}>
                            No rows in this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((entry) => (
                          <tr key={entry.row}>
                            <td>
                              {entry.status === "Valid" && (
                                <span className="import-badge import-badge--valid">
                                  ✓ Valid
                                </span>
                              )}
                              {entry.status === "Duplicate" && (
                                <span className="import-badge import-badge--duplicate">
                                  ⚠ Duplicate
                                </span>
                              )}
                              {entry.status === "Invalid" && (
                                <span className="import-badge import-badge--invalid">
                                  ✕ Invalid
                                </span>
                              )}
                            </td>
                            <td><strong>{entry.vendor || "-"}</strong></td>
                            <td className="import-table__amount">
                              {Number.isFinite(entry.amount) ? formatMoney(entry.amount) : "-"}
                            </td>
                            <td>{entry.category || "-"}</td>
                            <td>{entry.department || "-"}</td>
                            <td>{entry.date || "-"}</td>
                            <td>
                              {entry.reason ? (
                                <span className="import-reason-tag">{entry.reason}</span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>&mdash;</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Action Bar */}
                <div className="import-actions-bar">
                  <span className="import-actions-bar__notice">
                    Invalid and duplicate rows are skipped automatically. Existing records remain safe.
                  </span>

                  <div className="import-actions-bar__btns">
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={reset}
                      disabled={isBusy}
                    >
                      Cancel / Choose another file
                    </button>

                    <button
                      type="button"
                      className="btn btn--primary"
                      onClick={handleConfirmImport}
                      disabled={isBusy || preview.summary.valid === 0}
                      title={
                        preview.summary.valid === 0
                          ? "No valid rows to import"
                          : undefined
                      }
                    >
                      {isBusy
                        ? "Importing..."
                        : `Import ${preview.summary.valid.toLocaleString()} Transaction${
                            preview.summary.valid === 1 ? "" : "s"
                          }`}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ADMIN: STEP 3 - IMPORTED CONFIRMATION */}
          {isAdmin && step === "imported" && result && (
            <section className="import-success-card" aria-label="Import complete">
              <div className="import-success-icon" aria-hidden="true">
                ✓
              </div>

              <h2 className="import-success-title">Import Completed</h2>

              <p className="import-success-desc">
                {result.message}
                {result.duplicateSkipped > 0 &&
                  ` ${result.duplicateSkipped} duplicate row${
                    result.duplicateSkipped === 1 ? "" : "s"
                  } skipped.`}
                {result.invalidSkipped > 0 &&
                  ` ${result.invalidSkipped} invalid row${
                    result.invalidSkipped === 1 ? "" : "s"
                  } skipped.`}
              </p>

              <div className="import-success-actions">
                <Link to="/transactions" className="btn btn--primary">
                  View Transactions &rarr;
                </Link>
                <button type="button" className="btn btn--ghost" onClick={reset}>
                  Import Another File
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default ImportTransactions;
