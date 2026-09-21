import Link from "next/link";
import { and, count, eq, gte, inArray, lt } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { WORK_ORDER_STATUS_LABELS, money } from "@servicebox/shared";
import { StatusBadge } from "@/components/status-badge";

export default async function DashboardPage() {
  const session = await requireSession();
  const tenantId = session.tenantId;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [todayJobs, unscheduledRows, openInvoices, agreementsDueRows] = await Promise.all([
    db.query.workOrders.findMany({
      where: and(
        eq(schema.workOrders.tenantId, tenantId),
        gte(schema.workOrders.scheduledStart, startOfDay),
        lt(schema.workOrders.scheduledStart, endOfDay),
      ),
      with: { customer: true, jobSite: true, assignees: { with: { user: true } } },
      orderBy: (wo, { asc }) => [asc(wo.scheduledStart)],
    }),
    db
      .select({ value: count() })
      .from(schema.workOrders)
      .where(and(eq(schema.workOrders.tenantId, tenantId), eq(schema.workOrders.status, "UNSCHEDULED"))),
    db.query.invoices.findMany({
      where: and(eq(schema.invoices.tenantId, tenantId), inArray(schema.invoices.status, ["SENT", "PARTIAL"])),
      with: { customer: true, lines: true },
      limit: 5,
      orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    }),
    db
      .select({ value: count() })
      .from(schema.maintenanceAgreements)
      .where(and(eq(schema.maintenanceAgreements.tenantId, tenantId), eq(schema.maintenanceAgreements.active, true))),
  ]);

  const unscheduled = unscheduledRows[0]?.value ?? 0;
  const agreementsDue = agreementsDueRows[0]?.value ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Jobs today" value={todayJobs.length} href="/schedule" />
        <StatCard label="Unscheduled queue" value={unscheduled} href="/work-orders?status=UNSCHEDULED" />
        <StatCard label="Open invoices" value={openInvoices.length} href="/invoices" />
        <StatCard label="Active PM agreements" value={agreementsDue} href="/agreements" />
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3">Today&rsquo;s jobs</h2>
        {todayJobs.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing scheduled for today.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>WO #</th>
                <th>Customer / site</th>
                <th>Assigned</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {todayJobs.map((wo) => (
                <tr key={wo.id}>
                  <td>
                    <Link href={`/work-orders/${wo.id}`} className="text-brand-600 hover:underline">
                      #{wo.number}
                    </Link>
                  </td>
                  <td>
                    {wo.customer.name}
                    {wo.jobSite ? ` — ${wo.jobSite.name}` : ""}
                  </td>
                  <td>{wo.assignees.map((a) => `${a.user.firstName} ${a.user.lastName}`).join(", ") || "Unassigned"}</td>
                  <td>{wo.scheduledStart ? new Date(wo.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>
                    <StatusBadge status={wo.status} labels={WORK_ORDER_STATUS_LABELS} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3">Open invoices (AR snapshot)</h2>
        {openInvoices.length === 0 ? (
          <p className="text-sm text-slate-500">No outstanding invoices.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {openInvoices.map((inv) => {
                const total = inv.lines.reduce((sum, l) => sum + Number(l.unitPrice) * Number(l.quantity), 0);
                return (
                  <tr key={inv.id}>
                    <td>
                      <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">
                        #{inv.number}
                      </Link>
                    </td>
                    <td>{inv.customer.name}</td>
                    <td>{inv.status}</td>
                    <td>{money(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card p-4 hover:border-brand-300 transition-colors block">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
    </Link>
  );
}
