import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { can } from "@servicebox/shared";
import { StatusBadge } from "@/components/status-badge";
import { WORK_ORDER_STATUS_FLOW, WORK_ORDER_STATUS_LABELS, money } from "@servicebox/shared";
import { AssignForm } from "./assign-form";
import { AddWorkOrderLineForm } from "./add-line-form";
import {
  updateWorkOrderStatusAction,
  removeAssigneeAction,
  linkEquipmentAction,
  removeWorkOrderLineAction,
  addWorkOrderNoteAction,
  applyChecklistTemplateAction,
} from "../actions";

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;
  const canSeeCosts = can(session.role, "view_costs");

  const workOrder = await db.query.workOrders.findFirst({
    where: and(eq(schema.workOrders.id, id), eq(schema.workOrders.tenantId, session.tenantId)),
    with: {
      customer: true,
      jobSite: { with: { equipment: true } },
      quote: true,
      assignees: { with: { user: true } },
      equipmentLinks: { with: { equipment: true } },
      lines: true,
      notes: { orderBy: (n, { desc }) => [desc(n.createdAt)] },
      checklists: { with: { template: true, responses: true } },
      invoices: true,
    },
  });
  if (!workOrder) notFound();

  const [technicians, catalogItems, checklistTemplates] = await Promise.all([
    db.query.users.findMany({ where: and(eq(schema.users.tenantId, session.tenantId), eq(schema.users.active, true)) }),
    db.query.catalogItems.findMany({ where: and(eq(schema.catalogItems.tenantId, session.tenantId), eq(schema.catalogItems.active, true)) }),
    db.query.checklistTemplates.findMany({ where: eq(schema.checklistTemplates.tenantId, session.tenantId) }),
  ]);

  const totalCost = workOrder.lines.reduce((sum, l) => sum + Number(l.unitCost) * Number(l.quantity), 0);
  const totalPrice = workOrder.lines.reduce((sum, l) => sum + Number(l.unitPrice) * Number(l.quantity), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            WO #{workOrder.number} <StatusBadge status={workOrder.status} labels={WORK_ORDER_STATUS_LABELS} />
          </h1>
          <p className="text-sm text-slate-500">
            <Link href={`/customers/${workOrder.customer.id}`} className="hover:underline">
              {workOrder.customer.name}
            </Link>
            {workOrder.jobSite ? (
              <>
                {" — "}
                <Link href={`/customers/${workOrder.customer.id}/sites/${workOrder.jobSite.id}`} className="hover:underline">
                  {workOrder.jobSite.name}
                </Link>
              </>
            ) : null}
          </p>
          <p className="mt-1">{workOrder.title}</p>
          {workOrder.description ? <p className="text-sm text-slate-600 mt-1">{workOrder.description}</p> : null}
          {workOrder.quote ? (
            <p className="text-xs text-slate-400 mt-1">
              From <Link href={`/quotes/${workOrder.quote.id}`} className="hover:underline">quote #{workOrder.quote.number}</Link>
            </p>
          ) : null}
        </div>
        <Link href="/work-orders" className="btn-secondary">
          Back to work orders
        </Link>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 mr-2">Status:</span>
        {WORK_ORDER_STATUS_FLOW.map((status) => (
          <form key={status} action={updateWorkOrderStatusAction}>
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <input type="hidden" name="status" value={status} />
            <button
              type="submit"
              disabled={workOrder.status === status}
              className={workOrder.status === status ? "btn-secondary opacity-50" : "btn-secondary"}
            >
              {WORK_ORDER_STATUS_LABELS[status]}
            </button>
          </form>
        ))}
        {(workOrder.status === "COMPLETE" || workOrder.status === "READY_TO_INVOICE") && workOrder.invoices.length === 0 ? (
          <Link href={`/invoices/new?workOrderId=${workOrder.id}`} className="btn-primary ml-auto">
            Create invoice
          </Link>
        ) : null}
        {workOrder.invoices.map((inv) => (
          <Link key={inv.id} href={`/invoices/${inv.id}`} className="btn-secondary ml-auto">
            View invoice #{inv.number}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-4">
            <h2 className="font-medium mb-3">Assigned technicians</h2>
            <ul className="divide-y divide-slate-100 mb-4 text-sm">
              {workOrder.assignees.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      {a.user.firstName} {a.user.lastName}
                    </span>
                    {a.scheduledStart ? (
                      <span className="text-slate-500">
                        {" "}
                        — {new Date(a.scheduledStart).toLocaleString()}
                        {a.scheduledEnd ? ` to ${new Date(a.scheduledEnd).toLocaleTimeString()}` : ""}
                      </span>
                    ) : (
                      <span className="text-slate-400"> — no time scheduled yet</span>
                    )}
                  </div>
                  <form action={removeAssigneeAction}>
                    <input type="hidden" name="assigneeId" value={a.id} />
                    <input type="hidden" name="workOrderId" value={workOrder.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
              {workOrder.assignees.length === 0 ? <li className="py-2 text-slate-500">Unassigned.</li> : null}
            </ul>
            <AssignForm workOrderId={workOrder.id} technicians={technicians} />
          </section>

          {workOrder.jobSite ? (
            <section className="card p-4">
              <h2 className="font-medium mb-3">Equipment on this job</h2>
              <ul className="divide-y divide-slate-100 mb-4 text-sm">
                {workOrder.equipmentLinks.map((link) => (
                  <li key={link.id} className="py-2">
                    {link.equipment.name}
                  </li>
                ))}
                {workOrder.equipmentLinks.length === 0 ? <li className="py-2 text-slate-500">No equipment linked yet.</li> : null}
              </ul>
              {workOrder.jobSite.equipment.length > 0 ? (
                <form action={linkEquipmentAction} className="flex gap-2">
                  <input type="hidden" name="workOrderId" value={workOrder.id} />
                  <select name="equipmentId" className="input" required>
                    {workOrder.jobSite.equipment.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-secondary shrink-0">
                    Link
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}

          <section className="card p-4">
            <h2 className="font-medium mb-3">Line items {canSeeCosts ? "(job costing)" : ""}</h2>
            <table className="table mb-4">
              <thead>
                <tr>
                  <th>Kind</th>
                  <th>Description</th>
                  <th>Qty</th>
                  {canSeeCosts ? <th>Cost</th> : null}
                  <th>Price</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {workOrder.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.kind}</td>
                    <td>{line.description}</td>
                    <td>{line.quantity}</td>
                    {canSeeCosts ? <td>{money(Number(line.unitCost) * Number(line.quantity))}</td> : null}
                    <td>{money(Number(line.unitPrice) * Number(line.quantity))}</td>
                    <td>
                      <form action={removeWorkOrderLineAction}>
                        <input type="hidden" name="lineId" value={line.id} />
                        <input type="hidden" name="workOrderId" value={workOrder.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {workOrder.lines.length === 0 ? (
                  <tr>
                    <td colSpan={canSeeCosts ? 6 : 5} className="text-center text-slate-500 py-4">
                      No line items yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {workOrder.lines.length > 0 ? (
                <tfoot>
                  <tr className="font-medium">
                    <td colSpan={canSeeCosts ? 3 : 2}>Total</td>
                    {canSeeCosts ? <td>{money(totalCost)}</td> : null}
                    <td>{money(totalPrice)}</td>
                    <td>{canSeeCosts ? `Margin ${money(totalPrice - totalCost)}` : ""}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
            <AddWorkOrderLineForm workOrderId={workOrder.id} catalogItems={catalogItems} />
          </section>

          <section className="card p-4">
            <h2 className="font-medium mb-3">Checklists</h2>
            {workOrder.checklists.map((instance) => (
              <div key={instance.id} className="mb-4 border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{instance.template.name}</span>
                  <span className="text-xs text-slate-500">{instance.completedAt ? "Completed" : "Pending field completion"}</span>
                </div>
                <ul className="text-sm space-y-1">
                  {instance.template.fields.map((f) => {
                    const response = instance.responses.find((r) => r.fieldKey === f.key);
                    return (
                      <li key={f.key} className="flex justify-between text-slate-600">
                        <span>{f.label}</span>
                        <span>{response ? String(response.value ?? "—") : "—"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {checklistTemplates.length > 0 ? (
              <form action={applyChecklistTemplateAction} className="flex gap-2">
                <input type="hidden" name="workOrderId" value={workOrder.id} />
                <select name="templateId" className="input" required>
                  {checklistTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary shrink-0">
                  Attach checklist
                </button>
              </form>
            ) : null}
          </section>

          <section className="card p-4">
            <h2 className="font-medium mb-3">Notes</h2>
            <form action={addWorkOrderNoteAction} className="mb-4 space-y-2">
              <input type="hidden" name="workOrderId" value={workOrder.id} />
              <textarea name="body" className="input" rows={2} placeholder="Add a note..." />
              <button type="submit" className="btn-secondary text-sm">
                Add note
              </button>
            </form>
            <ul className="space-y-3">
              {workOrder.notes.map((n) => (
                <li key={n.id} className="text-sm border-l-2 border-slate-200 pl-3">
                  <p>{n.body}</p>
                  <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                </li>
              ))}
              {workOrder.notes.length === 0 ? <li className="text-sm text-slate-500">No notes yet.</li> : null}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="font-medium mb-3">Details</h2>
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-slate-500">Priority</dt>
                <dd>{workOrder.priority}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Scheduled</dt>
                <dd>{workOrder.scheduledStart ? new Date(workOrder.scheduledStart).toLocaleString() : "Not scheduled"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Completed</dt>
                <dd>{workOrder.completedAt ? new Date(workOrder.completedAt).toLocaleString() : "—"}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
