import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { QUOTE_STATUS_FLOW, computeTotals, money } from "@servicebox/shared";
import { AddLineForm } from "./add-line-form";
import { removeQuoteLineAction, updateQuoteStatusAction, convertQuoteToWorkOrderAction } from "../actions";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const quote = await db.query.quotes.findFirst({
    where: and(eq(schema.quotes.id, id), eq(schema.quotes.tenantId, session.tenantId)),
    with: {
      customer: { with: { defaultTaxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      jobSite: { with: { taxGroup: { with: { rates: { with: { taxRate: true } } } } } },
      lines: { orderBy: (l, { asc }) => [asc(l.sortOrder)] },
      workOrder: true,
    },
  });
  if (!quote) notFound();

  const catalogItems = await db.query.catalogItems.findMany({
    where: and(eq(schema.catalogItems.tenantId, session.tenantId), eq(schema.catalogItems.active, true)),
    orderBy: (i, { asc }) => [asc(i.name)],
  });

  const taxGroup = quote.jobSite?.taxGroup ?? quote.customer.defaultTaxGroup;
  const taxRates = (taxGroup?.rates ?? []).map((r) => Number(r.taxRate.rate));
  const totals = computeTotals(quote.lines, taxRates);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Quote #{quote.number} <StatusBadge status={quote.status} />
          </h1>
          <p className="text-sm text-slate-500">
            <Link href={`/customers/${quote.customer.id}`} className="hover:underline">
              {quote.customer.name}
            </Link>
            {quote.jobSite ? ` — ${quote.jobSite.name}` : ""}
          </p>
        </div>
        <Link href="/quotes" className="btn-secondary">
          Back to quotes
        </Link>
      </div>

      <div className="card p-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-500 mr-2">Update status:</span>
        {QUOTE_STATUS_FLOW.map((status) => (
          <form key={status} action={updateQuoteStatusAction}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <input type="hidden" name="status" value={status} />
            <button
              type="submit"
              disabled={quote.status === status}
              className={quote.status === status ? "btn-secondary opacity-50" : "btn-secondary"}
            >
              {status}
            </button>
          </form>
        ))}
        {quote.status === "APPROVED" && !quote.workOrder ? (
          <form action={convertQuoteToWorkOrderAction} className="ml-auto">
            <input type="hidden" name="quoteId" value={quote.id} />
            <button type="submit" className="btn-primary">
              Convert to work order
            </button>
          </form>
        ) : null}
        {quote.workOrder ? (
          <Link href={`/work-orders/${quote.workOrder.id}`} className="btn-secondary ml-auto">
            View work order #{quote.workOrder.number}
          </Link>
        ) : null}
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3">Line items</h2>
        <table className="table mb-4">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Taxable</th>
              <th>Line total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id}>
                <td>{line.description}</td>
                <td>{line.quantity}</td>
                <td>{money(line.unitPrice)}</td>
                <td>{line.taxable ? "Yes" : "No"}</td>
                <td>{money(Number(line.quantity) * Number(line.unitPrice))}</td>
                <td>
                  <form action={removeQuoteLineAction}>
                    <input type="hidden" name="lineId" value={line.id} />
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {quote.lines.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-4">
                  No line items yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="flex justify-end">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span>{money(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tax</span>
              <span>{money(totals.tax)}</span>
            </div>
            <div className="flex justify-between font-medium text-base border-t pt-1">
              <span>Total</span>
              <span>{money(totals.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 max-w-xl">
        <h2 className="font-medium mb-3">Add line item</h2>
        <AddLineForm quoteId={quote.id} catalogItems={catalogItems} />
      </div>
    </div>
  );
}
