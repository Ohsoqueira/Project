import { and, count, eq, gte, inArray, isNotNull } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { WORK_ORDER_STATUS_FLOW, WORK_ORDER_STATUS_LABELS, computeTotals, money } from "@servicebox/shared";

export default async function ReportsPage() {
  const session = await requireSession();
  const tenantId = session.tenantId;

  const [statusCounts, openInvoices, agreementsActive, agreementsGenerated, users] = await Promise.all([
    Promise.all(
      WORK_ORDER_STATUS_FLOW.map(async (status) => {
        const [row] = await db
          .select({ value: count() })
          .from(schema.workOrders)
          .where(and(eq(schema.workOrders.tenantId, tenantId), eq(schema.workOrders.status, status)));
        return { status, count: row?.value ?? 0 };
      }),
    ),
    db.query.invoices.findMany({
      where: and(eq(schema.invoices.tenantId, tenantId), inArray(schema.invoices.status, ["SENT", "PARTIAL", "DRAFT"])),
      with: {
        lines: true,
        allocations: true,
        customer: { with: { defaultTaxGroup: { with: { rates: { with: { taxRate: true } } } } } },
        jobSite: { with: { taxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      },
    }),
    db.select({ value: count() }).from(schema.maintenanceAgreements).where(and(eq(schema.maintenanceAgreements.tenantId, tenantId), eq(schema.maintenanceAgreements.active, true))),
    db
      .select({ value: count() })
      .from(schema.maintenanceAgreements)
      .where(and(eq(schema.maintenanceAgreements.tenantId, tenantId), eq(schema.maintenanceAgreements.active, true), isNotNull(schema.maintenanceAgreements.lastGeneratedAt))),
    db.query.users.findMany({ where: and(eq(schema.users.tenantId, tenantId), eq(schema.users.active, true)) }),
  ]);

  const ar = openInvoices.reduce((sum, inv) => {
    const taxGroup = inv.jobSite?.taxGroup ?? inv.customer.defaultTaxGroup;
    const taxRates = (taxGroup?.rates ?? []).map((r) => Number(r.taxRate.rate));
    const { total } = computeTotals(inv.lines, taxRates);
    const paid = inv.allocations.reduce((s, a) => s + Number(a.amount), 0);
    return sum + Math.max(0, total - paid);
  }, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const productivity = await Promise.all(
    users.map(async (u) => {
      const entries = await db.query.timeEntries.findMany({
        where: and(eq(schema.timeEntries.userId, u.id), gte(schema.timeEntries.startedAt, weekAgo)),
      });
      const hours = entries.reduce((sum, e) => sum + (e.endedAt ? (e.endedAt.getTime() - e.startedAt.getTime()) / 3600000 : 0), 0);
      return { user: u, hours, jobCount: new Set(entries.map((e) => e.workOrderId)).size };
    }),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-medium mb-3">Work order status</h2>
          <table className="table">
            <tbody>
              {statusCounts.map((row) => (
                <tr key={row.status}>
                  <td>{WORK_ORDER_STATUS_LABELS[row.status]}</td>
                  <td className="text-right font-medium">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-4">
          <h2 className="font-medium mb-3">Accounts receivable</h2>
          <p className="text-3xl font-semibold">{money(ar)}</p>
          <p className="text-sm text-slate-500 mt-1">Outstanding across {openInvoices.length} open invoice(s)</p>
        </section>

        <section className="card p-4">
          <h2 className="font-medium mb-3">Technician productivity (last 7 days)</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Jobs touched</th>
                <th>Hours logged</th>
              </tr>
            </thead>
            <tbody>
              {productivity
                .filter((p) => p.hours > 0 || p.jobCount > 0)
                .map((p) => (
                  <tr key={p.user.id}>
                    <td>
                      {p.user.firstName} {p.user.lastName}
                    </td>
                    <td>{p.jobCount}</td>
                    <td>{p.hours.toFixed(1)}</td>
                  </tr>
                ))}
              {productivity.every((p) => p.hours === 0 && p.jobCount === 0) ? (
                <tr>
                  <td colSpan={3} className="text-center text-slate-500 py-4">
                    No activity in the last 7 days.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="card p-4">
          <h2 className="font-medium mb-3">PM compliance</h2>
          <p className="text-3xl font-semibold">
            {agreementsGenerated[0]?.value ?? 0} / {agreementsActive[0]?.value ?? 0}
          </p>
          <p className="text-sm text-slate-500 mt-1">Active agreements that have generated at least one visit</p>
        </section>
      </div>
    </div>
  );
}
