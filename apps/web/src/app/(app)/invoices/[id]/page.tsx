import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { can } from "@servicebox/shared";
import { StatusBadge } from "@/components/status-badge";
import { INVOICE_STATUS_FLOW, computeTotals, money } from "@servicebox/shared";
import { AddInvoiceLineForm } from "./add-line-form";
import { RecordPaymentForm } from "./record-payment-form";
import { removeInvoiceLineAction, updateInvoiceStatusAction } from "../actions";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(schema.invoices.id, id), eq(schema.invoices.tenantId, session.tenantId)),
    with: {
      customer: { with: { defaultTaxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      jobSite: { with: { taxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      workOrder: true,
      lines: { orderBy: (l, { asc }) => [asc(l.sortOrder)] },
      allocations: { with: { payment: true } },
    },
  });
  if (!invoice) notFound();

  const catalogItems = await db.query.catalogItems.findMany({
    where: and(eq(schema.catalogItems.tenantId, session.tenantId), eq(schema.catalogItems.active, true)),
  });

  const taxGroup = invoice.jobSite?.taxGroup ?? invoice.customer.defaultTaxGroup;
  const taxRates = (taxGroup?.rates ?? []).map((r) => Number(r.taxRate.rate));
  const totals = computeTotals(invoice.lines, taxRates);
  const paid = invoice.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
  const balanceDue = Math.max(0, totals.total - paid);
  const canRecordPayment = can(session.role, "payments_write");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Invoice #{invoice.number} <StatusBadge status={invoice.status} />
          </h1>
          <p className="text-sm text-slate-500">
            <Link href={`/customers/${invoice.customer.id}`} className="hover:underline">
              {invoice.customer.name}
            </Link>
            {invoice.jobSite ? ` — ${invoice.jobSite.name}` : ""}
            {invoice.workOrder ? (
              <>
                {" · "}
                <Link href={`/work-orders/${invoice.workOrder.id}`} className="hover:underline">
                  WO #{invoice.workOrder.number}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <Link href="/invoices" className="btn-secondary">
          Back to invoices
        </Link>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 mr-2">Status:</span>
        {INVOICE_STATUS_FLOW.map((status) => (
          <form key={status} action={updateInvoiceStatusAction}>
            <input type="hidden" name="invoiceId" value={invoice.id} />
            <input type="hidden" name="status" value={status} />
            <button
              type="submit"
              disabled={invoice.status === status}
              className={invoice.status === status ? "btn-secondary opacity-50" : "btn-secondary"}
            >
              {status}
            </button>
          </form>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="card p-4">
            <h2 className="font-medium mb-3">Line items</h2>
            <table className="table mb-4">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit price</th>
                  <th>Line total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{line.description}</td>
                    <td>{line.quantity}</td>
                    <td>{money(line.unitPrice)}</td>
                    <td>{money(Number(line.quantity) * Number(line.unitPrice))}</td>
                    <td>
                      <form action={removeInvoiceLineAction}>
                        <input type="hidden" name="lineId" value={line.id} />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                        <button type="submit" className="text-xs text-red-600 hover:underline">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {invoice.lines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-slate-500 py-4">
                      No line items yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="flex justify-end mb-4">
              <div className="w-64 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal</span>
                  <span>{money(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax</span>
                  <span>{money(totals.tax)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Total</span>
                  <span>{money(totals.total)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Paid</span>
                  <span>{money(paid)}</span>
                </div>
                <div className="flex justify-between font-medium text-base">
                  <span>Balance due</span>
                  <span>{money(balanceDue)}</span>
                </div>
              </div>
            </div>
            <AddInvoiceLineForm invoiceId={invoice.id} catalogItems={catalogItems} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="font-medium mb-3">Payments</h2>
            <p className="text-xs text-slate-500 mb-3">
              Manual recording (cash/cheque/e-transfer, or a card charged elsewhere). A live card-charging PSP integration
              (Stripe pay link) is a later phase — see README.
            </p>
            <ul className="text-sm divide-y divide-slate-100 mb-4">
              {invoice.allocations.map((a) => (
                <li key={a.id} className="py-2 flex justify-between">
                  <span>
                    {a.payment.method} {a.payment.reference ? `(${a.payment.reference})` : ""}
                  </span>
                  <span>{money(a.amount)}</span>
                </li>
              ))}
              {invoice.allocations.length === 0 ? <li className="py-2 text-slate-500">No payments recorded yet.</li> : null}
            </ul>
            {canRecordPayment && balanceDue > 0 ? (
              <RecordPaymentForm invoiceId={invoice.id} balanceDue={balanceDue} />
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
