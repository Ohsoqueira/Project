"use client";

import { useState } from "react";
import { createWorkOrderAction } from "../actions";

type Customer = { id: string; name: string; jobSites: { id: string; name: string }[] };

export function NewWorkOrderForm({ customers }: { customers: Customer[] }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const sites = customers.find((c) => c.id === customerId)?.jobSites ?? [];

  return (
    <form action={createWorkOrderAction} className="card p-6 space-y-4 max-w-xl">
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
      <div>
        <label className="label">Title</label>
        <input name="title" required className="input" placeholder="Brief summary of the job" />
      </div>
      <div>
        <label className="label">Description / scope</label>
        <textarea name="description" className="input" rows={3} />
      </div>
      <div>
        <label className="label">Priority</label>
        <select name="priority" className="input" defaultValue="NORMAL">
          <option value="LOW">Low</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>
      <button type="submit" className="btn-primary">
        Create work order
      </button>
    </form>
  );
}
