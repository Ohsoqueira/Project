import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { computeTotals, money } from "@servicebox/shared";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await requireSession();
  const { customerId } = await searchParams;

  const quotes = await db.query.quotes.findMany({
    where: customerId
      ? and(eq(schema.quotes.tenantId, session.tenantId), eq(schema.quotes.customerId, customerId))
      : eq(schema.quotes.tenantId, session.tenantId),
    with: { customer: true, jobSite: true, lines: true },
    orderBy: (q, { desc }) => [desc(q.createdAt)],
    limit: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Quotes</h1>
        <Link href="/quotes/new" className="btn-primary">
          + New quote
        </Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Customer / site</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => {
              const { total } = computeTotals(q.lines, []);
              return (
                <tr key={q.id}>
                  <td>
                    <Link href={`/quotes/${q.id}`} className="text-brand-600 hover:underline">
                      #{q.number}
                    </Link>
                  </td>
                  <td>{q.title}</td>
                  <td>
                    {q.customer.name}
                    {q.jobSite ? ` — ${q.jobSite.name}` : ""}
                  </td>
                  <td>{money(total)}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                </tr>
              );
            })}
            {quotes.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-6">
                  No quotes yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
