import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { money } from "@servicebox/shared";
import { createCatalogItemAction, archiveCatalogItemAction } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  LABOUR: "Labour",
  SERVICE: "Service",
  MATERIAL: "Material",
  OTHER: "Other",
};

export default async function CatalogPage() {
  const session = await requireSession();

  const items = await db.query.catalogItems.findMany({
    where: eq(schema.catalogItems.tenantId, session.tenantId),
    orderBy: (i, { asc }) => [asc(i.name)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catalog</h1>
        <Link href="/catalog/taxes" className="btn-secondary">
          Manage taxes
        </Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Type</th>
              <th>Unit cost</th>
              <th>Unit price</th>
              <th>Taxable</th>
              <th>Tracks inventory</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className={item.active ? "" : "opacity-50"}>
                <td className="font-mono text-xs">{item.code ?? "—"}</td>
                <td>{item.name}</td>
                <td>{TYPE_LABELS[item.type]}</td>
                <td>{money(item.unitCost)}</td>
                <td>{money(item.unitPrice)}</td>
                <td>{item.taxable ? "Yes" : "No"}</td>
                <td>{item.trackInventory ? "Yes" : "No"}</td>
                <td>{item.active ? "Active" : "Archived"}</td>
                <td>
                  {item.active ? (
                    <form action={archiveCatalogItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit" className="text-xs text-red-600 hover:underline">
                        Archive
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-slate-500 py-6">
                  No catalog items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="card p-4 max-w-2xl">
        <h2 className="font-medium mb-3">Add catalog item</h2>
        <form action={createCatalogItemAction} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="code" className="input" placeholder="Code (optional)" />
            <select name="type" className="input" required defaultValue="MATERIAL">
              <option value="LABOUR">Labour</option>
              <option value="SERVICE">Service</option>
              <option value="MATERIAL">Material</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <input name="name" required className="input" placeholder="Item name" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Unit cost</label>
              <input name="unitCost" type="number" step="0.01" defaultValue="0" className="input" />
            </div>
            <div>
              <label className="label">Unit price</label>
              <input name="unitPrice" type="number" step="0.01" defaultValue="0" className="input" />
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="taxable" defaultChecked /> Taxable
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="trackInventory" /> Track inventory
            </label>
          </div>
          <button type="submit" className="btn-primary">
            Add item
          </button>
        </form>
      </div>
    </div>
  );
}
