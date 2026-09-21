"use client";

import { useState } from "react";
import { createAgreementAction } from "./actions";

type Equipment = { id: string; name: string };
type JobSite = { id: string; name: string; equipment: Equipment[] };
type Customer = { id: string; name: string; jobSites: JobSite[] };
type ChecklistTemplate = { id: string; name: string };

export function NewAgreementForm({ customers, checklistTemplates }: { customers: Customer[]; checklistTemplates: ChecklistTemplate[] }) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [jobSiteId, setJobSiteId] = useState("");
  const sites = customers.find((c) => c.id === customerId)?.jobSites ?? [];
  const equipmentOptions = sites.find((s) => s.id === jobSiteId)?.equipment ?? [];

  return (
    <form action={createAgreementAction} className="card p-6 space-y-4 max-w-xl">
      <div>
        <label className="label">Agreement name</label>
        <input name="name" required className="input" placeholder="Quarterly RTU maintenance" />
      </div>
      <div>
        <label className="label">Customer</label>
        <select
          name="customerId"
          required
          className="input"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setJobSiteId("");
          }}
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Job site (optional)</label>
        <select name="jobSiteId" className="input" value={jobSiteId} onChange={(e) => setJobSiteId(e.target.value)}>
          <option value="">— No specific site —</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {equipmentOptions.length > 0 ? (
        <div>
          <label className="label">Equipment (optional)</label>
          <select name="equipmentId" className="input" defaultValue="">
            <option value="">— Whole site —</option>
            {equipmentOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Interval</label>
          <select name="interval" className="input" defaultValue="QUARTERLY">
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="SEMI_ANNUAL">Semi-annual</option>
            <option value="ANNUAL">Annual</option>
          </select>
        </div>
        <div>
          <label className="label">Lead days</label>
          <input name="leadDays" type="number" defaultValue="14" className="input" />
        </div>
      </div>
      <div>
        <label className="label">Start date</label>
        <input name="startDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
      </div>
      {checklistTemplates.length > 0 ? (
        <div>
          <label className="label">Checklist template (optional)</label>
          <select name="checklistTemplateId" className="input" defaultValue="">
            <option value="">— None —</option>
            {checklistTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="scheduleFromLastVisit" /> Base next visit off last completed WO
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="autoScheduleOnCalendar" /> Auto-place on calendar
        </label>
      </div>
      <button type="submit" className="btn-primary">
        Create agreement
      </button>
    </form>
  );
}
