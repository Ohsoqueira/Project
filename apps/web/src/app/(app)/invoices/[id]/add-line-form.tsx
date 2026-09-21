"use client";

import { useState } from "react";
import { addInvoiceLineAction } from "../actions";

type CatalogItem = { id: string; name: string; unitPrice: string; taxable: boolean };

export function AddInvoiceLineForm({ invoiceId, catalogItems }: { invoiceId: string; catalogItems: CatalogItem[] }) {
  const [selected, setSelected] = useState<CatalogItem | null>(null);

  return (
    <form action={addInvoiceLineAction} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <div>
        <label className="label">Catalog item (optional)</label>
        <select
          name="catalogItemId"
          className="input"
          defaultValue=""
          onChange={(e) => setSelected(catalogItems.find((i) => i.id === e.target.value) ?? null)}
        >
          <option value="">— Custom line —</option>
          {catalogItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Description</label>
        <input name="description" required className="input" defaultValue={selected?.name ?? ""} key={`d-${selected?.id ?? "c"}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Quantity</label>
          <input name="quantity" type="number" step="0.01" defaultValue="1" className="input" />
        </div>
        <div>
          <label className="label">Unit price</label>
          <input name="unitPrice" type="number" step="0.01" defaultValue={selected?.unitPrice ?? "0"} key={`p-${selected?.id ?? "c"}`} className="input" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="taxable" defaultChecked={selected?.taxable ?? true} key={`t-${selected?.id ?? "c"}`} />
        Taxable
      </label>
      <button type="submit" className="btn-primary">
        Add line
      </button>
    </form>
  );
}
