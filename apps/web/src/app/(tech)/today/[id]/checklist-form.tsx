"use client";

import { submitChecklistResponseAction } from "../../actions";

type Field = { key: string; label: string; type: string; required: boolean; options?: string[] };
type Response = { fieldKey: string; value: unknown };

export function ChecklistForm({
  workOrderId,
  instanceId,
  fields,
  responses,
}: {
  workOrderId: string;
  instanceId: string;
  fields: Field[];
  responses: Response[];
}) {
  const valueFor = (key: string) => responses.find((r) => r.fieldKey === key)?.value;

  return (
    <form action={submitChecklistResponseAction} className="space-y-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="instanceId" value={instanceId} />
      {fields.map((field) => (
        <div key={field.key}>
          <label className="label">
            {field.label} {field.required ? <span className="text-red-500">*</span> : null}
          </label>
          {field.type === "boolean" ? (
            <input type="checkbox" name={`field:${field.key}`} defaultChecked={Boolean(valueFor(field.key))} />
          ) : field.type === "number" ? (
            <input type="number" name={`field:${field.key}`} defaultValue={String(valueFor(field.key) ?? "")} className="input" />
          ) : (
            <input type="text" name={`field:${field.key}`} defaultValue={String(valueFor(field.key) ?? "")} className="input" />
          )}
        </div>
      ))}
      <button type="submit" className="btn-primary text-sm">
        Save checklist
      </button>
    </form>
  );
}
