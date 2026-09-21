import { eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { NewQuoteForm } from "./new-quote-form";

export default async function NewQuotePage() {
  const session = await requireSession();

  const customers = await db.query.customers.findMany({
    where: eq(schema.customers.tenantId, session.tenantId),
    with: { jobSites: true },
    orderBy: (c, { asc }) => [asc(c.name)],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New quote</h1>
      {customers.length === 0 ? (
        <p className="text-sm text-slate-500">Add a customer first.</p>
      ) : (
        <NewQuoteForm customers={customers} />
      )}
    </div>
  );
}
