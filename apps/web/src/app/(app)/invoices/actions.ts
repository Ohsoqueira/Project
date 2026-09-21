"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";
import { nextInvoiceNumber } from "@/lib/numbering";
import { computeTotals } from "@servicebox/shared";

export async function createInvoiceFromWorkOrderAction(formData: FormData) {
  const session = await requireCapability("invoices_write");
  const workOrderId = String(formData.get("workOrderId"));

  const workOrder = await db.query.workOrders.findFirst({
    where: and(eq(schema.workOrders.id, workOrderId), eq(schema.workOrders.tenantId, session.tenantId)),
    with: { lines: true },
  });
  if (!workOrder) throw new Error("Work order not found");

  const number = await nextInvoiceNumber(session.tenantId);

  const [invoice] = await db
    .insert(schema.invoices)
    .values({
      tenantId: session.tenantId,
      number,
      customerId: workOrder.customerId,
      jobSiteId: workOrder.jobSiteId,
      workOrderId: workOrder.id,
      status: "DRAFT",
      createdById: session.userId,
    })
    .returning();

  const billableLines = workOrder.lines.filter((l) => l.billable);
  if (billableLines.length > 0) {
    await db.insert(schema.invoiceLines).values(
      billableLines.map((line, i) => ({
        invoiceId: invoice.id,
        catalogItemId: line.catalogItemId,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxable: line.taxable,
        sortOrder: i,
      })),
    );
  }

  redirect(`/invoices/${invoice.id}`);
}

export async function createBlankInvoiceAction(formData: FormData) {
  const session = await requireCapability("invoices_write");
  const customerId = String(formData.get("customerId"));
  const jobSiteId = String(formData.get("jobSiteId") ?? "") || null;

  const number = await nextInvoiceNumber(session.tenantId);
  const [invoice] = await db
    .insert(schema.invoices)
    .values({ tenantId: session.tenantId, number, customerId, jobSiteId, status: "DRAFT", createdById: session.userId })
    .returning();

  redirect(`/invoices/${invoice.id}`);
}

export async function addInvoiceLineAction(formData: FormData) {
  await requireCapability("invoices_write");
  const invoiceId = String(formData.get("invoiceId"));

  await db.insert(schema.invoiceLines).values({
    invoiceId,
    catalogItemId: String(formData.get("catalogItemId") ?? "") || null,
    description: String(formData.get("description") ?? "").trim(),
    quantity: String(formData.get("quantity") ?? "1"),
    unitPrice: String(formData.get("unitPrice") ?? "0"),
    taxable: formData.get("taxable") === "on",
  });

  revalidatePath(`/invoices/${invoiceId}`);
}

export async function removeInvoiceLineAction(formData: FormData) {
  await requireCapability("invoices_write");
  const lineId = String(formData.get("lineId"));
  const invoiceId = String(formData.get("invoiceId"));
  await db.delete(schema.invoiceLines).where(eq(schema.invoiceLines.id, lineId));
  revalidatePath(`/invoices/${invoiceId}`);
}

export async function updateInvoiceStatusAction(formData: FormData) {
  const session = await requireCapability("invoices_write");
  const invoiceId = String(formData.get("invoiceId"));
  const status = formData.get("status") as "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "VOID";

  await db
    .update(schema.invoices)
    .set({ status, ...(status === "SENT" ? { sentAt: new Date() } : {}) })
    .where(and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.tenantId, session.tenantId)));

  revalidatePath(`/invoices/${invoiceId}`);
}

// Records a manual payment (cash/cheque/e-transfer/card-not-through-PSP)
// and allocates it fully to this invoice; flips status to PARTIAL/PAID
// based on how much of the invoice total is now covered.
export async function recordPaymentAction(formData: FormData) {
  const session = await requireCapability("payments_write");
  const invoiceId = String(formData.get("invoiceId"));
  const amount = String(formData.get("amount") ?? "0");
  const method = formData.get("method") as "CARD" | "CASH" | "CHEQUE" | "E_TRANSFER" | "OTHER";
  const reference = String(formData.get("reference") ?? "") || null;

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.tenantId, session.tenantId)),
    with: {
      lines: true,
      allocations: true,
      customer: { with: { defaultTaxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      jobSite: { with: { taxGroup: { with: { rates: { with: { taxRate: true } } } } } },
    },
  });
  if (!invoice) throw new Error("Invoice not found");

  const [payment] = await db
    .insert(schema.payments)
    .values({ method, amount, reference, recordedById: session.userId })
    .returning();

  await db.insert(schema.paymentAllocations).values({ paymentId: payment.id, invoiceId, amount });

  const taxGroup = invoice.jobSite?.taxGroup ?? invoice.customer.defaultTaxGroup;
  const taxRates = (taxGroup?.rates ?? []).map((r) => Number(r.taxRate.rate));
  const { total } = computeTotals(invoice.lines, taxRates);
  const paidSoFar = invoice.allocations.reduce((sum, a) => sum + Number(a.amount), 0) + Number(amount);
  const status = paidSoFar >= total ? "PAID" : paidSoFar > 0 ? "PARTIAL" : invoice.status;

  await db.update(schema.invoices).set({ status }).where(eq(schema.invoices.id, invoiceId));

  revalidatePath(`/invoices/${invoiceId}`);
}
