import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { StatusBadge } from "@/components/status-badge";
import { WORK_ORDER_STATUS_LABELS } from "@servicebox/shared";

export default async function TodayPage() {
  const session = await requireSession();

  const assignments = await db.query.workOrderAssignees.findMany({
    where: eq(schema.workOrderAssignees.userId, session.userId),
    with: {
      workOrder: { with: { customer: true, jobSite: true } },
    },
    orderBy: (a, { asc }) => [asc(a.scheduledStart)],
  });

  const openEntry = await db.query.timeEntries.findFirst({
    where: and(eq(schema.timeEntries.userId, session.userId), isNull(schema.timeEntries.endedAt)),
  });

  const jobs = assignments
    .map((a) => a.workOrder)
    .filter((wo) => wo.status !== "COMPLETE" && wo.status !== "CANCELLED");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My schedule</h1>
      {openEntry ? (
        <div className="card p-3 bg-amber-50 border-amber-200 text-sm text-amber-800">
          You are currently clocked in on a job. Open it below to clock out.
        </div>
      ) : null}
      <div className="space-y-3">
        {jobs.map((wo) => (
          <Link key={wo.id} href={`/today/${wo.id}`} className="card p-4 block">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">#{wo.number}</span>
              <StatusBadge status={wo.status} labels={WORK_ORDER_STATUS_LABELS} />
            </div>
            <p className="text-sm">{wo.title}</p>
            <p className="text-sm text-slate-500">
              {wo.customer.name}
              {wo.jobSite ? ` — ${wo.jobSite.name}` : ""}
            </p>
            {wo.scheduledStart ? (
              <p className="text-xs text-slate-400 mt-1">{new Date(wo.scheduledStart).toLocaleString()}</p>
            ) : null}
          </Link>
        ))}
        {jobs.length === 0 ? <p className="text-sm text-slate-500">No jobs assigned right now.</p> : null}
      </div>
    </div>
  );
}
