const COLORS: Record<string, string> = {
  UNSCHEDULED: "bg-slate-100 text-slate-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  WAITING: "bg-orange-100 text-orange-700",
  COMPLETE: "bg-emerald-100 text-emerald-700",
  READY_TO_INVOICE: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-red-100 text-red-700",
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-700",
  VIEWED: "bg-sky-100 text-sky-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  VOID: "bg-slate-100 text-slate-400",
};

export function StatusBadge({ status, labels }: { status: string; labels?: Record<string, string> }) {
  const color = COLORS[status] ?? "bg-slate-100 text-slate-700";
  return <span className={`badge ${color}`}>{labels?.[status] ?? status.replace(/_/g, " ")}</span>;
}
