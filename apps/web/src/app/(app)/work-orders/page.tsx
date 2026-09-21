import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { WORK_ORDER_STATUS_FLOW, WORK_ORDER_STATUS_LABELS } from "@servicebox/shared";

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; customerId?: string }>;
}) {
  const session = await requireSession();
  const { status, customerId } = await searchParams;

  const conditions = [eq(schema.workOrders.tenantId, session.tenantId)];
  if (status) conditions.push(eq(schema.workOrders.status, status as (typeof WORK_ORDER_STATUS_FLOW)[number]));
  if (customerId) conditions.push(eq(schema.workOrders.customerId, customerId));

  const workOrders = await db.query.workOrders.findMany({
    where: and(...conditions),
    with: { customer: true, jobSite: true, assignees: { with: { user: true } } },
    orderBy: (wo, { desc }) => [desc(wo.createdAt)],
    limit: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Work orders</h1>
        <Link href="/work-orders/new" className="btn-primary">
          + New work order
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/work-orders" className={!status ? "btn-secondary" : "btn-secondary opacity-60"}>
          All
        </Link>
        {WORK_ORDER_STATUS_FLOW.map((s) => (
          <Link key={s} href={`/work-orders?status=${s}`} className={status === s ? "btn-secondary" : "btn-secondary opacity-60"}>
            {WORK_ORDER_STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Customer / site</th>
              <th>Assigned</th>
              <th>Scheduled</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((wo) => (
              <tr key={wo.id}>
                <td>
                  <Link href={`/work-orders/${wo.id}`} className="text-brand-600 hover:underline">
                    #{wo.number}
                  </Link>
                </td>
                <td>{wo.title}</td>
                <td>
                  {wo.customer.name}
                  {wo.jobSite ? ` — ${wo.jobSite.name}` : ""}
                </td>
                <td>{wo.assignees.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ") || "—"}</td>
                <td>{wo.scheduledStart ? new Date(wo.scheduledStart).toLocaleString() : "—"}</td>
                <td>
                  <StatusBadge status={wo.status} labels={WORK_ORDER_STATUS_LABELS} />
                </td>
              </tr>
            ))}
            {workOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-6">
                  No work orders match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
