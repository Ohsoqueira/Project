"use client";

import { recordPaymentAction } from "../actions";

export function RecordPaymentForm({ invoiceId, balanceDue }: { invoiceId: string; balanceDue: number }) {
  return (
    <form action={recordPaymentAction} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div>
        <label className="label">Amount</label>
        <input name="amount" type="number" step="0.01" defaultValue={balanceDue.toFixed(2)} max={balanceDue} className="input" required />
      </div>
      <div>
        <label className="label">Method</label>
        <select name="method" className="input" defaultValue="CARD">
          <option value="CARD">Card</option>
          <option value="CASH">Cash</option>
          <option value="CHEQUE">Cheque</option>
          <option value="E_TRANSFER">E-transfer</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="label">Reference (optional)</label>
        <input name="reference" className="input" placeholder="Confirmation #" />
      </div>
      <button type="submit" className="btn-primary">
        Record payment
      </button>
    </form>
  );
}
