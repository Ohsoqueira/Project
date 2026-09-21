"use client";

import { useState } from "react";
import { createBlankInvoiceAction } from "../actions";

type Customer = { id: string; name: string; jobSites: { id: string; name: string }[] };

export function NewInvoiceForm({ customers }: { customers: Customer[] }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const sites = customers.find((c) => c.id === customerId)?.jobSites ?? [];

  return (
    <form action={createBlankInvoiceAction} className="card p-6 space-y-4 max-w-xl">
      <div>
        <label className="label">Customer</label>
        <select name="customerId" required className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Job site (optional)</label>
        <select name="jobSiteId" className="input" defaultValue="">
          <option value="">— No specific site —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary">
        Create invoice
      </button>
    </form>
  );
}
