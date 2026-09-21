"use client";

import { useState } from "react";
import { addWorkOrderLineAction } from "../actions";

type CatalogItem = { id: string; name: string; type: string; unitCost: string; unitPrice: string; taxable: boolean };

export function AddWorkOrderLineForm({ workOrderId, catalogItems }: { workOrderId: string; catalogItems: CatalogItem[] }) {
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const kind = selected?.type === "LABOUR" ? "LABOUR" : selected?.type === "SERVICE" ? "SERVICE" : "MATERIAL";

  return (
    <form action={addWorkOrderLineAction} className="space-y-3">
      <input type="hidden" name="workOrderId" value={workOrderId} />
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
        <input name="description" required className="input" defaultValue={selected?.name ?? ""} key={`desc-${selected?.id ?? "c"}`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <select name="kind" className="input" defaultValue={kind} key={`kind-${selected?.id ?? "c"}`}>
          <option value="LABOUR">Labour</option>
          <option value="MATERIAL">Material</option>
          <option value="SERVICE">Service</option>
        </select>
        <input name="quantity" type="number" step="0.01" defaultValue="1" className="input" placeholder="Qty" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Unit cost</label>
          <input name="unitCost" type="number" step="0.01" defaultValue={selected?.unitCost ?? "0"} key={`cost-${selected?.id ?? "c"}`} className="input" />
        </div>
        <div>
          <label className="label">Unit price</label>
          <input
            name="unitPrice"
            type="number"
            step="0.01"
            defaultValue={selected?.unitPrice ?? "0"}
            key={`price-${selected?.id ?? "c"}`}
            className="input"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="taxable" defaultChecked={selected?.taxable ?? true} key={`tax-${selected?.id ?? "c"}`} />
        Taxable / billable
      </label>
      <button type="submit" className="btn-primary">
        Add line
      </button>
    </form>
  );
}
