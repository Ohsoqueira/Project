import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { createInvoiceFromWorkOrderAction } from "../actions";
import { NewInvoiceForm } from "./new-invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ workOrderId?: string }>;
}) {
  const session = await requireSession();
  const { workOrderId } = await searchParams;

  if (workOrderId) {
    const workOrder = await db.query.workOrders.findFirst({
      where: and(eq(schema.workOrders.id, workOrderId), eq(schema.workOrders.tenantId, session.tenantId)),
      with: { customer: true, jobSite: true, lines: true },
    });
    if (!workOrder) {
      return <p className="text-sm text-red-600">Work order not found.</p>;
    }

    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-semibold">New invoice from WO #{workOrder.number}</h1>
        <div className="card p-4 text-sm">
          <p className="font-medium">
            {workOrder.customer.name}
            {workOrder.jobSite ? ` — ${workOrder.jobSite.name}` : ""}
          </p>
          <p className="text-slate-500 mt-1">{workOrder.lines.filter((l) => l.billable).length} billable line item(s) will be copied to the invoice.</p>
        </div>
        <form action={createInvoiceFromWorkOrderAction}>
          <input type="hidden" name="workOrderId" value={workOrder.id} />
          <button type="submit" className="btn-primary">
            Create invoice
          </button>
        </form>
      </div>
    );
  }

  const customers = await db.query.customers.findMany({
    where: eq(schema.customers.tenantId, session.tenantId),
    with: { jobSites: true },
    orderBy: (c, { asc }) => [asc(c.name)],
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New invoice</h1>
      {customers.length === 0 ? <p className="text-sm text-slate-500">Add a customer first.</p> : <NewInvoiceForm customers={customers} />}
    </div>
  );
}
