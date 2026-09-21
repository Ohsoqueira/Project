"use client";

import { assignTechnicianAction } from "../actions";

type TechUser = { id: string; firstName: string; lastName: string };

export function AssignForm({ workOrderId, technicians }: { workOrderId: string; technicians: TechUser[] }) {
  return (
    <form action={assignTechnicianAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <div>
        <label className="label">Technician</label>
        <select name="userId" required className="input">
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Scheduled start</label>
        <input type="datetime-local" name="scheduledStart" className="input" />
      </div>
      <div>
        <label className="label">Scheduled end</label>
        <input type="datetime-local" name="scheduledEnd" className="input" />
      </div>
      <button type="submit" className="btn-primary">
        Assign
      </button>
    </form>
  );
}
