"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";
import { nextQuoteNumber, nextWorkOrderNumber } from "@/lib/numbering";

export async function createQuoteAction(formData: FormData) {
  const session = await requireCapability("quotes_write");

  const customerId = String(formData.get("customerId"));
  const jobSiteId = String(formData.get("jobSiteId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();

  const number = await nextQuoteNumber(session.tenantId);

  const [quote] = await db
    .insert(schema.quotes)
    .values({ tenantId: session.tenantId, number, customerId, jobSiteId, title, status: "DRAFT" })
    .returning();

  await db.insert(schema.quoteStatusHistory).values({ quoteId: quote.id, status: "DRAFT", changedById: session.userId });

  redirect(`/quotes/${quote.id}`);
}

export async function addQuoteLineAction(formData: FormData) {
  await requireCapability("quotes_write");

  const quoteId = String(formData.get("quoteId"));
  const catalogItemId = String(formData.get("catalogItemId") ?? "") || null;
  const description = String(formData.get("description") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "1");
  const unitPrice = String(formData.get("unitPrice") ?? "0");

  await db.insert(schema.quoteLines).values({
    quoteId,
    catalogItemId,
    description,
    quantity,
    unitPrice,
    taxable: formData.get("taxable") === "on",
  });

  revalidatePath(`/quotes/${quoteId}`);
}

export async function removeQuoteLineAction(formData: FormData) {
  await requireCapability("quotes_write");
  const lineId = String(formData.get("lineId"));
  const quoteId = String(formData.get("quoteId"));

  await db.delete(schema.quoteLines).where(eq(schema.quoteLines.id, lineId));
  revalidatePath(`/quotes/${quoteId}`);
}

export async function updateQuoteStatusAction(formData: FormData) {
  const session = await requireCapability("quotes_write");
  const quoteId = String(formData.get("quoteId"));
  const status = formData.get("status") as "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "REJECTED" | "EXPIRED";

  const timestamps: Record<string, Date> = {};
  if (status === "SENT") timestamps.sentAt = new Date();
  if (status === "APPROVED" || status === "REJECTED") timestamps.respondedAt = new Date();

  await db
    .update(schema.quotes)
    .set({ status, ...timestamps })
    .where(and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, session.tenantId)));

  await db.insert(schema.quoteStatusHistory).values({ quoteId, status, changedById: session.userId });

  revalidatePath(`/quotes/${quoteId}`);
}

// Converts an approved quote into a work order, carrying scope + line
// items across so office/field never re-key the accepted quote (§9.4 US-Q-4).
export async function convertQuoteToWorkOrderAction(formData: FormData) {
  const session = await requireCapability("workorders_write");
  const quoteId = String(formData.get("quoteId"));

  const quote = await db.query.quotes.findFirst({
    where: and(eq(schema.quotes.id, quoteId), eq(schema.quotes.tenantId, session.tenantId)),
    with: { lines: { with: { catalogItem: true } } },
  });
  if (!quote) throw new Error("Quote not found");
  if (quote.status !== "APPROVED") throw new Error("Only approved quotes can be converted to a work order.");

  const number = await nextWorkOrderNumber(session.tenantId);

  const [workOrder] = await db
    .insert(schema.workOrders)
    .values({
      tenantId: session.tenantId,
      number,
      customerId: quote.customerId,
      jobSiteId: quote.jobSiteId,
      quoteId: quote.id,
      title: quote.title,
      description: quote.notes,
      status: "UNSCHEDULED",
      createdById: session.userId,
    })
    .returning();

  if (quote.lines.length > 0) {
    await db.insert(schema.workOrderLines).values(
      quote.lines.map((line) => ({
        workOrderId: workOrder.id,
        catalogItemId: line.catalogItemId,
        kind: (line.catalogItem?.type === "LABOUR" ? "LABOUR" : line.catalogItem?.type === "SERVICE" ? "SERVICE" : "MATERIAL") as
          | "LABOUR"
          | "SERVICE"
          | "MATERIAL",
        description: line.description,
        quantity: line.quantity,
        unitCost: line.catalogItem?.unitCost ?? "0",
        unitPrice: line.unitPrice,
        taxable: line.taxable,
      })),
    );
  }

  await db.insert(schema.workOrderStatusHistory).values({ workOrderId: workOrder.id, status: "UNSCHEDULED" });

  redirect(`/work-orders/${workOrder.id}`);
}
