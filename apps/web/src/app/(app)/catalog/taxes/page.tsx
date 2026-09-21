import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { createTaxRateAction, createTaxGroupAction } from "../actions";

export default async function TaxesPage() {
  const session = await requireSession();

  const [rates, groups] = await Promise.all([
    db.query.taxRates.findMany({ where: eq(schema.taxRates.tenantId, session.tenantId) }),
    db.query.taxGroups.findMany({
      where: eq(schema.taxGroups.tenantId, session.tenantId),
      with: { rates: { with: { taxRate: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Taxes</h1>
        <Link href="/catalog" className="btn-secondary">
          Back to catalog
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-medium mb-3">Tax rates</h2>
          <ul className="divide-y divide-slate-100 mb-4 text-sm">
            {rates.map((r) => (
              <li key={r.id} className="py-2 flex justify-between">
                <span>{r.name}</span>
                <span>{(Number(r.rate) * 100).toFixed(2)}%</span>
              </li>
            ))}
            {rates.length === 0 ? <li className="py-2 text-slate-500">No tax rates yet.</li> : null}
          </ul>
          <form action={createTaxRateAction} className="flex gap-2">
            <input name="name" required className="input" placeholder="e.g. GST" />
            <input name="ratePercent" type="number" step="0.01" required className="input" placeholder="5" />
            <button type="submit" className="btn-primary shrink-0">
              Add
            </button>
          </form>
        </section>

        <section className="card p-4">
          <h2 className="font-medium mb-3">Tax groups</h2>
          <ul className="divide-y divide-slate-100 mb-4 text-sm">
            {groups.map((g) => (
              <li key={g.id} className="py-2">
                <div className="font-medium">{g.name}</div>
                <div className="text-slate-500 text-xs">
                  {g.rates.map((r) => r.taxRate.name).join(" + ") || "No rates"}
                </div>
              </li>
            ))}
            {groups.length === 0 ? <li className="py-2 text-slate-500">No tax groups yet.</li> : null}
          </ul>
          <form action={createTaxGroupAction} className="space-y-2">
            <input name="name" required className="input" placeholder="e.g. Ontario HST 13%" />
            <div className="flex flex-wrap gap-3 text-sm">
              {rates.map((r) => (
                <label key={r.id} className="flex items-center gap-1.5">
                  <input type="checkbox" name="rateIds" value={r.id} /> {r.name}
                </label>
              ))}
            </div>
            <button type="submit" className="btn-primary">
              Create group
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
