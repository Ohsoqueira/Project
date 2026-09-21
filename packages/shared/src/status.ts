export const WORK_ORDER_STATUS_FLOW = [
  "UNSCHEDULED",
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING",
  "COMPLETE",
  "READY_TO_INVOICE",
  "CANCELLED",
] as const;

export const QUOTE_STATUS_FLOW = ["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED", "EXPIRED"] as const;

export const INVOICE_STATUS_FLOW = ["DRAFT", "SENT", "PARTIAL", "PAID", "VOID"] as const;

export const WORK_ORDER_STATUS_LABELS: Record<(typeof WORK_ORDER_STATUS_FLOW)[number], string> = {
  UNSCHEDULED: "Unscheduled",
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  WAITING: "Waiting",
  COMPLETE: "Complete",
  READY_TO_INVOICE: "Ready to invoice",
  CANCELLED: "Cancelled",
};

export function money(amount: number | string, currency = "CAD") {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(value);
}
