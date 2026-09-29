import { formatMoney, formatDate, formatDateTime } from "../utils/format";
import "./../styles/transactions.css";

/** View transaction modal (Part 4). */
function TransactionViewModal({ transaction, onClose, onEdit }) {
  if (!transaction) return null;

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-view-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h2 id="transaction-view-title">Transaction Details</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <dl className="info-list txn-view">
          <div>
            <dt>Amount</dt>
            <dd className="txn-view__amount">{formatMoney(transaction.amount)}</dd>
          </div>
          <div>
            <dt>Vendor</dt>
            <dd>{transaction.vendor}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{transaction.category}</dd>
          </div>
          <div>
            <dt>Cost Centre / Department</dt>
            <dd>{transaction.department}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatDate(transaction.date)}</dd>
          </div>
          <div>
            <dt>Description / Notes</dt>
            <dd>{transaction.description ? transaction.description : "-"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(transaction.createdAt)}</dd>
          </div>
          <div>
            <dt>Last updated</dt>
            <dd>{formatDateTime(transaction.updatedAt)}</dd>
          </div>
        </dl>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
          {onEdit && (
            <button type="button" className="btn" onClick={() => onEdit(transaction)}>
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TransactionViewModal;
