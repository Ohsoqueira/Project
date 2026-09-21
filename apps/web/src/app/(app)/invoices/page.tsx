import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { computeTotals, money } from "@servicebox/shared";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await requireSession();
  const { customerId } = await searchParams;

  const invoices = await db.query.invoices.findMany({
    where: customerId
      ? and(eq(schema.invoices.tenantId, session.tenantId), eq(schema.invoices.customerId, customerId))
      : eq(schema.invoices.tenantId, session.tenantId),
    with: {
      customer: { with: { defaultTaxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      jobSite: { with: { taxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      lines: true,
      allocations: true,
    },
    orderBy: (inv, { desc }) => [desc(inv.createdAt)],
    limit: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <Link href="/invoices/new" className="btn-primary">
          + New invoice
        </Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer / site</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => {
              const taxGroup = inv.jobSite?.taxGroup ?? inv.customer.defaultTaxGroup;
              const taxRates = (taxGroup?.rates ?? []).map((r) => Number(r.taxRate.rate));
              const { total } = computeTotals(inv.lines, taxRates);
              const paid = inv.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
              return (
                <tr key={inv.id}>
                  <td>
                    <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">
                      #{inv.number}
                    </Link>
                  </td>
                  <td>
                    {inv.customer.name}
                    {inv.jobSite ? ` — ${inv.jobSite.name}` : ""}
                  </td>
                  <td>{money(total)}</td>
                  <td>{money(paid)}</td>
                  <td>
                    <StatusBadge status={inv.status} />
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-6">
                  No invoices yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
