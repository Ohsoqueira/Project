import Link from "next/link";
import { and, eq, ilike } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;

  const customers = await db.query.customers.findMany({
    where: q
      ? and(eq(schema.customers.tenantId, session.tenantId), ilike(schema.customers.name, `%${q}%`))
      : eq(schema.customers.tenantId, session.tenantId),
    with: { jobSites: true },
    orderBy: (c, { asc }) => [asc(c.name)],
    limit: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <Link href="/customers/new" className="btn-primary">
          + New customer
        </Link>
      </div>

      <form className="max-w-sm">
        <input className="input" type="search" name="q" placeholder="Search customers..." defaultValue={q ?? ""} />
      </form>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Job sites</th>
              <th>Phone</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/customers/${c.id}`} className="text-brand-600 hover:underline font-medium">
                    {c.name}
                  </Link>
                </td>
                <td>{c.category ?? "—"}</td>
                <td>{c.jobSites.length}</td>
                <td>{c.phone ?? "—"}</td>
                <td>{c.email ?? "—"}</td>
              </tr>
            ))}
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-slate-500 py-6">
                  No customers yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
