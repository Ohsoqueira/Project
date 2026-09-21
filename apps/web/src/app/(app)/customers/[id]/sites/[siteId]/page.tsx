import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { createContactAction, createEquipmentAction, createNoteAction } from "../../../actions";

export default async function JobSiteDetailPage({
  params,
}: {
  params: Promise<{ id: string; siteId: string }>;
}) {
  const session = await requireSession();
  const { id: customerId, siteId } = await params;

  const site = await db.query.jobSites.findFirst({
    where: and(eq(schema.jobSites.id, siteId), eq(schema.jobSites.customerId, customerId)),
    with: {
      customer: true,
      contacts: true,
      equipment: { orderBy: (e, { asc }) => [asc(e.name)] },
      notes: { orderBy: (n, { desc }) => [desc(n.createdAt)], limit: 20 },
    },
  });

  if (!site || site.customer.tenantId !== session.tenantId) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <p className="text-sm text-slate-500">
            {site.address}
            {site.city ? `, ${site.city}` : ""} {site.region ?? ""}
          </p>
        </div>
        <Link href={`/customers/${customerId}`} className="btn-secondary">
          Back to {site.customer.name}
        </Link>
      </div>

      {site.accessNotes ? (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <h2 className="font-medium text-amber-800 mb-1">Access notes</h2>
          <p className="text-sm text-amber-900">{site.accessNotes}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card p-4">
          <h2 className="font-medium mb-3">Equipment</h2>
          <ul className="divide-y divide-slate-100 mb-4">
            {site.equipment.map((item) => (
              <li key={item.id} className="py-2 text-sm">
                <div className="font-medium">{item.name}</div>
                <div className="text-slate-500">
                  {[item.manufacturer, item.modelNumber].filter(Boolean).join(" ")}
                  {item.serialNumber ? ` · SN ${item.serialNumber}` : ""}
                </div>
              </li>
            ))}
            {site.equipment.length === 0 ? <li className="py-2 text-sm text-slate-500">No equipment recorded yet.</li> : null}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-brand-600">+ Add equipment</summary>
            <form action={createEquipmentAction} className="mt-3 space-y-3">
              <input type="hidden" name="jobSiteId" value={site.id} />
              <input type="hidden" name="customerId" value={customerId} />
              <input name="name" required className="input" placeholder="Rooftop Unit 2" />
              <div className="grid grid-cols-2 gap-3">
                <input name="manufacturer" className="input" placeholder="Manufacturer" />
                <input name="modelNumber" className="input" placeholder="Model #" />
              </div>
              <input name="serialNumber" className="input" placeholder="Serial #" />
              <button type="submit" className="btn-primary">
                Add equipment
              </button>
            </form>
          </details>
        </section>

        <section className="card p-4">
          <h2 className="font-medium mb-3">Site contacts</h2>
          <ul className="divide-y divide-slate-100 mb-4">
            {site.contacts.map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <span className="font-medium">
                  {c.firstName} {c.lastName}
                </span>{" "}
                {c.role ? <span className="text-slate-500">({c.role})</span> : null}
                <div className="text-slate-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
            {site.contacts.length === 0 ? <li className="py-2 text-sm text-slate-500">No site contacts yet.</li> : null}
          </ul>
          <details className="text-sm">
            <summary className="cursor-pointer text-brand-600">+ Add site contact</summary>
            <form action={createContactAction} className="mt-3 space-y-3">
              <input type="hidden" name="customerId" value={customerId} />
              <input type="hidden" name="jobSiteId" value={site.id} />
              <div className="grid grid-cols-2 gap-3">
                <input name="firstName" required className="input" placeholder="First name" />
                <input name="lastName" required className="input" placeholder="Last name" />
              </div>
              <input name="role" className="input" placeholder="Role (e.g. Site manager)" />
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
      </div>

      <section className="card p-4">
        <h2 className="font-medium mb-3">Site notes</h2>
        <form action={createNoteAction} className="mb-4 space-y-2">
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="jobSiteId" value={site.id} />
          <textarea name="body" className="input" rows={2} placeholder="Add a note about this site..." />
          <button type="submit" className="btn-secondary text-sm">
            Add note
          </button>
        </form>
        <ul className="space-y-3">
          {site.notes.map((n) => (
            <li key={n.id} className="text-sm border-l-2 border-slate-200 pl-3">
              <p>{n.body}</p>
              <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
            </li>
          ))}
          {site.notes.length === 0 ? <li className="text-sm text-slate-500">No notes yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
