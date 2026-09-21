import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, isNull, and } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { money } from "@servicebox/shared";
import { createContactAction, createJobSiteAction, createNoteAction } from "../actions";
import { CustomerEditForm } from "./customer-edit-form";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const customer = await db.query.customers.findFirst({
    where: and(eq(schema.customers.id, id), eq(schema.customers.tenantId, session.tenantId)),
    with: {
      jobSites: { orderBy: (js, { asc }) => [asc(js.name)] },
      contacts: { where: isNull(schema.contacts.jobSiteId) },
      notes: { orderBy: (n, { desc }) => [desc(n.createdAt)], limit: 20 },
      quotes: { orderBy: (q, { desc }) => [desc(q.createdAt)], limit: 10 },
      workOrders: { orderBy: (wo, { desc }) => [desc(wo.createdAt)], limit: 10 },
      invoices: { orderBy: (inv, { desc }) => [desc(inv.createdAt)], limit: 10, with: { lines: true } },
    },
  });

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          <p className="text-sm text-slate-500">{customer.category ?? "Commercial customer"}</p>
        </div>
        <Link href="/customers" className="btn-secondary">
          Back to customers
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-4">
            <h2 className="font-medium mb-3">Details</h2>
            <CustomerEditForm customer={customer} />
          </section>

          <section className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium">Job sites</h2>
            </div>
            <ul className="divide-y divide-slate-100 mb-4">
              {customer.jobSites.map((site) => (
                <li key={site.id} className="py-2">
                  <Link href={`/customers/${customer.id}/sites/${site.id}`} className="text-brand-600 hover:underline font-medium">
                    {site.name}
                  </Link>
                  <p className="text-sm text-slate-500">{site.address}</p>
                </li>
              ))}
              {customer.jobSites.length === 0 ? <li className="py-2 text-sm text-slate-500">No job sites yet.</li> : null}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer text-brand-600">+ Add job site</summary>
              <form action={createJobSiteAction} className="mt-3 space-y-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <div>
                  <label className="label">Site name</label>
                  <input name="name" required className="input" placeholder="Downtown location" />
                </div>
                <div>
                  <label className="label">Address</label>
                  <input name="address" required className="input" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input name="city" className="input" placeholder="City" />
                  <input name="region" className="input" placeholder="Province/State" />
                </div>
                <div>
                  <label className="label">Access notes</label>
                  <textarea name="accessNotes" className="input" rows={2} />
                </div>
                <button type="submit" className="btn-primary">
                  Add site
                </button>
              </form>
            </details>
          </section>

          <section className="card p-4">
            <h2 className="font-medium mb-3">Contacts</h2>
            <ul className="divide-y divide-slate-100 mb-4">
              {customer.contacts.map((c) => (
                <li key={c.id} className="py-2 text-sm">
                  <span className="font-medium">
                    {c.firstName} {c.lastName}
                  </span>{" "}
                  {c.role ? <span className="text-slate-500">({c.role})</span> : null}
                  <div className="text-slate-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</div>
                </li>
              ))}
              {customer.contacts.length === 0 ? <li className="py-2 text-sm text-slate-500">No contacts yet.</li> : null}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer text-brand-600">+ Add contact</summary>
              <form action={createContactAction} className="mt-3 space-y-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <div className="grid grid-cols-2 gap-3">
                  <input name="firstName" required className="input" placeholder="First name" />
                  <input name="lastName" required className="input" placeholder="Last name" />
                </div>
                <input name="role" className="input" placeholder="Role (e.g. Billing)" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="email" type="email" className="input" placeholder="Email" />
                  <input name="phone" className="input" placeholder="Phone" />
                </div>
                <button type="submit" className="btn-primary">
                  Add contact
                </button>
              </form>
            </details>
          </section>

          <section className="card p-4">
            <h2 className="font-medium mb-3">Notes</h2>
            <form action={createNoteAction} className="mb-4 space-y-2">
              <input type="hidden" name="customerId" value={customer.id} />
              <textarea name="body" className="input" rows={2} placeholder="Add an internal note..." />
              <button type="submit" className="btn-secondary text-sm">
                Add note
              </button>
            </form>
            <ul className="space-y-3">
              {customer.notes.map((n) => (
                <li key={n.id} className="text-sm border-l-2 border-slate-200 pl-3">
                  <p>{n.body}</p>
                  <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                </li>
              ))}
              {customer.notes.length === 0 ? <li className="text-sm text-slate-500">No notes yet.</li> : null}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <HistoryCard title="Quotes" viewAllHref={`/quotes?customerId=${customer.id}`}>
            {customer.quotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between py-1.5">
                <Link href={`/quotes/${q.id}`} className="text-brand-600 hover:underline">
                  #{q.number} {q.title}
                </Link>
                <StatusBadge status={q.status} />
              </li>
            ))}
          </HistoryCard>

          <HistoryCard title="Work orders" viewAllHref={`/work-orders?customerId=${customer.id}`}>
            {customer.workOrders.map((wo) => (
              <li key={wo.id} className="flex items-center justify-between py-1.5">
                <Link href={`/work-orders/${wo.id}`} className="text-brand-600 hover:underline">
                  #{wo.number} {wo.title}
                </Link>
                <StatusBadge status={wo.status} />
              </li>
            ))}
          </HistoryCard>

          <HistoryCard title="Invoices" viewAllHref={`/invoices?customerId=${customer.id}`}>
            {customer.invoices.map((inv) => {
              const total = inv.lines.reduce((sum, l) => sum + Number(l.unitPrice) * Number(l.quantity), 0);
              return (
                <li key={inv.id} className="flex items-center justify-between py-1.5">
                  <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">
                    #{inv.number} — {money(total)}
                  </Link>
                  <StatusBadge status={inv.status} />
                </li>
              );
            })}
          </HistoryCard>
        </div>
      </div>
    </div>
  );
}

function HistoryCard({ title, viewAllHref, children }: { title: string; viewAllHref: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-medium">{title}</h2>
        <Link href={viewAllHref} className="text-xs text-brand-600 hover:underline">
          View all
        </Link>
      </div>
      <ul className="divide-y divide-slate-100 text-sm">{children}</ul>
    </section>
  );
}
