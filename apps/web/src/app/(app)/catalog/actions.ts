"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";

export async function createCatalogItemAction(formData: FormData) {
  const session = await requireCapability("crm_write");

  await db.insert(schema.catalogItems).values({
    tenantId: session.tenantId,
    code: String(formData.get("code") ?? "") || null,
    name: String(formData.get("name") ?? "").trim(),
    type: formData.get("type") as "LABOUR" | "SERVICE" | "MATERIAL" | "OTHER",
    unitCost: String(formData.get("unitCost") ?? "0"),
    unitPrice: String(formData.get("unitPrice") ?? "0"),
    taxable: formData.get("taxable") === "on",
    trackInventory: formData.get("trackInventory") === "on",
  });

  revalidatePath("/catalog");
}

// Once a catalog item has been used on a quote/WO/invoice, its pricing
// history must stay immutable (§11.3 invariant 4) — archiving instead of
// editing/deleting keeps historical documents intact.
export async function archiveCatalogItemAction(formData: FormData) {
  const session = await requireCapability("crm_write");
  const id = String(formData.get("id"));

  await db
    .update(schema.catalogItems)
    .set({ active: false })
    .where(and(eq(schema.catalogItems.id, id), eq(schema.catalogItems.tenantId, session.tenantId)));

  revalidatePath("/catalog");
}

export async function createTaxRateAction(formData: FormData) {
  const session = await requireCapability("manage_settings");

  await db.insert(schema.taxRates).values({
    tenantId: session.tenantId,
    name: String(formData.get("name") ?? "").trim(),
    rate: String(Number(formData.get("ratePercent") ?? 0) / 100),
  });

  revalidatePath("/catalog/taxes");
}

export async function createTaxGroupAction(formData: FormData) {
  const session = await requireCapability("manage_settings");

  const name = String(formData.get("name") ?? "").trim();
  const rateIds = formData.getAll("rateIds").map(String);

  const [group] = await db.insert(schema.taxGroups).values({ tenantId: session.tenantId, name }).returning();

  if (rateIds.length > 0) {
    await db.insert(schema.taxGroupRates).values(rateIds.map((taxRateId) => ({ taxGroupId: group.id, taxRateId })));
  }

  revalidatePath("/catalog/taxes");
}
