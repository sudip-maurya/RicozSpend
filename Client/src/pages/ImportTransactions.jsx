import { useState } from "react";
import { Link } from "react-router-dom";

import NavBar from "../components/NavBar";
import TransactionImportModal from "../components/TransactionImportModal";
import { useAuth } from "../context/authContext";
import "../styles/transactions.css";

/** Import page (Part 5 CSV import, reachable from the shared navbar). */
function ImportTransactions() {
  const { isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [lastResult, setLastResult] = useState("");

  return (
    <div className="app-shell">
      <NavBar />

      <main className="app-main">
        <div className="txn-toolbar">
          <div>
            <h1 className="page-title">Import</h1>
            <p className="page-subtitle">
              Upload a CSV file to add spend transactions in bulk.
            </p>
          </div>

          {isAdmin && (
            <div className="txn-toolbar__actions">
              <button type="button" className="btn" onClick={() => setIsOpen(true)}>
                Import CSV
              </button>
            </div>
          )}
        </div>

        {lastResult && <div className="alert alert--success">{lastResult}</div>}

        <section className="card">
          <h2>CSV format</h2>
          <p className="card__text">
            The file needs a header row followed by one row per transaction. Dates accept
            DD/MM/YYYY or YYYY-MM-DD; amounts must be greater than 0.
          </p>
          <pre className="import-sample">
{`Amount,Vendor,Category,Department,Date,Description
45000,Delta Airlines,Travel,Sales,18/09/2026,Client visit
12000,Staples,Office Supplies,Operations,20/09/2026,Stationery`}
          </pre>
          <p className="card__text">
            Every row is validated before anything is saved: the preview shows valid, invalid and
            duplicate rows, and only valid, non-duplicate rows are imported. Imported transactions
            behave exactly like manually added ones and appear in Transactions, Dashboard and
            Analysis.
          </p>
        </section>

        <section className="card">
          <h2>{isAdmin ? "Start an import" : "Import permission"}</h2>
          {isAdmin ? (
            <>
              <p className="card__text">
                Pick a CSV file, review the preview, then confirm. Existing transactions are never
                overwritten or deleted.
              </p>
              <div className="modal__actions">
                <button type="button" className="btn" onClick={() => setIsOpen(true)}>
                  Choose CSV file
                </button>
                <Link className="btn btn--ghost" to="/transactions">
                  View transactions
                </Link>
              </div>
            </>
          ) : (
            <p className="card__text">
              Your account has the Viewer role, which is read-only. You can review spend data, but
              importing is limited to Admin accounts.
            </p>
          )}
        </section>

        {isAdmin && isOpen && (
          <TransactionImportModal
            onClose={() => setIsOpen(false)}
            onImported={() => {
              setIsOpen(false);
              setLastResult("CSV import completed. The new transactions are available now.");
            }}
          />
        )}
      </main>
    </div>
  );
}

export default ImportTransactions;
