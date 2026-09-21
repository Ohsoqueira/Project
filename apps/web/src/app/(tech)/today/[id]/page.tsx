import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { WORK_ORDER_STATUS_LABELS } from "@servicebox/shared";
import { SignaturePad } from "./signature-pad";
import { ChecklistForm } from "./checklist-form";
import { clockInAction, clockOutAction, techUpdateStatusAction, techAddNoteAction, techAddMaterialAction } from "../../actions";

export default async function TechWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const workOrder = await db.query.workOrders.findFirst({
    where: and(eq(schema.workOrders.id, id), eq(schema.workOrders.tenantId, session.tenantId)),
    with: {
      customer: { with: { contacts: true } },
      jobSite: { with: { equipment: true } },
      equipmentLinks: { with: { equipment: { with: { notes: true } } } },
      assignees: true,
      lines: true,
      notes: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
      checklists: { with: { template: true, responses: true } },
      signatures: true,
    },
  });
  if (!workOrder) notFound();

  const isAssigned = workOrder.assignees.some((a) => a.userId === session.userId);
  if (!isAssigned) notFound();

  const [openEntry, catalogItems] = await Promise.all([
    db.query.timeEntries.findFirst({
      where: and(
        eq(schema.timeEntries.workOrderId, workOrder.id),
        eq(schema.timeEntries.userId, session.userId),
        isNull(schema.timeEntries.endedAt),
      ),
    }),
    db.query.catalogItems.findMany({ where: and(eq(schema.catalogItems.tenantId, session.tenantId), eq(schema.catalogItems.active, true)) }),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/today" className="text-sm text-brand-600 hover:underline">
        &larr; My schedule
      </Link>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold">#{workOrder.number}</h1>
          <StatusBadge status={workOrder.status} labels={WORK_ORDER_STATUS_LABELS} />
        </div>
        <p className="font-medium">{workOrder.title}</p>
        {workOrder.description ? <p className="text-sm text-slate-600 mt-1">{workOrder.description}</p> : null}
        <div className="mt-3 text-sm text-slate-600 space-y-1">
          <p className="font-medium">{workOrder.customer.name}</p>
          {workOrder.jobSite ? (
            <>
              <p>{workOrder.jobSite.name}</p>
              <p>{workOrder.jobSite.address}</p>
              {workOrder.jobSite.accessNotes ? (
                <p className="bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 text-xs mt-2">
                  {workOrder.jobSite.accessNotes}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {workOrder.equipmentLinks.length > 0 ? (
        <div className="card p-4">
          <h2 className="font-medium mb-2 text-sm">Equipment history</h2>
          {workOrder.equipmentLinks.map((link) => (
            <div key={link.id} className="text-sm mb-2">
              <p className="font-medium">{link.equipment.name}</p>
              {link.equipment.notes.slice(0, 3).map((n) => (
                <p key={n.id} className="text-slate-500 text-xs">
                  &bull; {n.body}
                </p>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="card p-4 space-y-2">
        <h2 className="font-medium text-sm">Time</h2>
        {openEntry ? (
          <form action={clockOutAction}>
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <button type="submit" className="btn-danger w-full">
              Clock out
            </button>
          </form>
        ) : (
          <form action={clockInAction}>
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <button type="submit" className="btn-primary w-full">
              Clock in / start job
            </button>
          </form>
        )}
        <div className="flex gap-2">
          <form action={techUpdateStatusAction} className="flex-1">
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <input type="hidden" name="status" value="WAITING" />
            <button type="submit" className="btn-secondary w-full">
              Mark waiting
            </button>
          </form>
          <form action={techUpdateStatusAction} className="flex-1">
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <input type="hidden" name="status" value="COMPLETE" />
            <button type="submit" className="btn-primary w-full">
              Mark complete
            </button>
          </form>
        </div>
      </div>

      {workOrder.checklists.map((instance) => (
        <div key={instance.id} className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium text-sm">{instance.template.name}</h2>
            {instance.completedAt ? <span className="text-xs text-emerald-600">Completed</span> : null}
          </div>
          <ChecklistForm
            workOrderId={workOrder.id}
            instanceId={instance.id}
            fields={instance.template.fields}
            responses={instance.responses}
          />
        </div>
      ))}

      <div className="card p-4">
        <h2 className="font-medium text-sm mb-2">Materials used</h2>
        <ul className="text-sm space-y-1 mb-3">
          {workOrder.lines
            .filter((l) => l.kind === "MATERIAL")
            .map((l) => (
              <li key={l.id}>
                {l.description} &times; {l.quantity}
              </li>
            ))}
          {workOrder.lines.filter((l) => l.kind === "MATERIAL").length === 0 ? (
            <li className="text-slate-500">None recorded yet.</li>
          ) : null}
        </ul>
        <form action={techAddMaterialAction} className="flex gap-2">
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <select name="catalogItemId" className="input" required>
            {catalogItems
              .filter((i) => i.type === "MATERIAL")
              .map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
          </select>
          <input name="quantity" type="number" step="1" defaultValue="1" className="input w-20" />
          <button type="submit" className="btn-secondary shrink-0">
            Add
          </button>
        </form>
      </div>

      <div className="card p-4">
        <h2 className="font-medium text-sm mb-2">Notes</h2>
        <form action={techAddNoteAction} className="space-y-2 mb-3">
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <textarea name="body" className="input" rows={2} placeholder="Add a note..." />
          <button type="submit" className="btn-secondary text-sm">
            Add note
          </button>
        </form>
        <ul className="space-y-2 text-sm">
          {workOrder.notes.map((n) => (
            <li key={n.id} className="border-l-2 border-slate-200 pl-2">
              {n.body}
            </li>
          ))}
        </ul>
      </div>

      <div className="card p-4">
        <h2 className="font-medium text-sm mb-2">Signature</h2>
        {workOrder.signatures.length > 0 ? (
          <div className="space-y-2 mb-3">
            {workOrder.signatures.map((sig) => (
              <div key={sig.id} className="text-xs text-slate-500">
                Captured from {sig.signerRole} {sig.signerName ? `(${sig.signerName})` : ""}
              </div>
            ))}
          </div>
        ) : null}
        <SignaturePad workOrderId={workOrder.id} />
      </div>
    </div>
  );
}
