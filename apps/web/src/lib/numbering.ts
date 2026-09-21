import "server-only";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";

// Atomically increments a tenant's counter and returns the pre-increment
// value to use as the new record's human-facing number (WO/quote/invoice).
async function nextCounter(tenantId: string, column: "workOrderCounter" | "quoteCounter" | "invoiceCounter") {
  const columnRef = {
    workOrderCounter: schema.tenants.workOrderCounter,
    quoteCounter: schema.tenants.quoteCounter,
    invoiceCounter: schema.tenants.invoiceCounter,
  }[column];

  const [row] = await db
    .update(schema.tenants)
    .set({ [column]: sql`${columnRef} + 1` })
    .where(eq(schema.tenants.id, tenantId))
    .returning({ value: columnRef });

  if (!row) throw new Error("Tenant not found");
  return row.value - 1;
}

export const nextWorkOrderNumber = (tenantId: string) => nextCounter(tenantId, "workOrderCounter");
export const nextQuoteNumber = (tenantId: string) => nextCounter(tenantId, "quoteCounter");
export const nextInvoiceNumber = (tenantId: string) => nextCounter(tenantId, "invoiceCounter");
