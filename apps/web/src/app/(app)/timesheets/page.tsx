import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { can } from "@servicebox/shared";
import { approveWeekAction } from "./actions";

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start of week
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function hoursBetween(start: Date, end: Date | null) {
  if (!end) return 0;
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

export default async function TimesheetsPage() {
  const session = await requireSession();
  const canApprove = can(session.role, "timesheets_approve");

  const periodStart = startOfWeek(new Date());
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 7);

  const users = await db.query.users.findMany({
    where: and(eq(schema.users.tenantId, session.tenantId), eq(schema.users.active, true)),
  });
  const userIds = users.map((u) => u.id);

  const entries = userIds.length
    ? await db.query.timeEntries.findMany({
        where: and(inArray(schema.timeEntries.userId, userIds), gte(schema.timeEntries.startedAt, periodStart), lt(schema.timeEntries.startedAt, periodEnd)),
        with: { workOrder: true },
      })
    : [];

  const recentTimesheets = userIds.length
    ? await db.query.timesheets.findMany({
        where: inArray(schema.timesheets.userId, userIds),
        with: { user: true },
        orderBy: (t, { desc }) => [desc(t.periodStart)],
        limit: 10,
      })
    : [];

  const byUser = users.map((user) => {
    const userEntries = entries.filter((e) => e.userId === user.id);
    const totalHours = userEntries.reduce((sum, e) => sum + hoursBetween(e.startedAt, e.endedAt), 0);
    const hasUnlinked = userEntries.some((e) => !e.timesheetId);
    return { user, entries: userEntries, totalHours, hasUnlinked };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Timesheets</h1>
      <p className="text-sm text-slate-500">
        Week of {periodStart.toLocaleDateString()} &ndash; {new Date(periodEnd.getTime() - 86400000).toLocaleDateString()}
      </p>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Technician</th>
              <th>Entries</th>
              <th>Hours this week</th>
              <th>Status</th>
              {canApprove ? <th></th> : null}
            </tr>
          </thead>
          <tbody>
            {byUser
              .filter((row) => row.entries.length > 0)
              .map((row) => (
                <tr key={row.user.id}>
                  <td>
                    {row.user.firstName} {row.user.lastName}
                  </td>
                  <td>{row.entries.length}</td>
                  <td>{row.totalHours.toFixed(1)}</td>
                  <td>{row.hasUnlinked ? "Pending review" : "Reviewed"}</td>
                  {canApprove ? (
                    <td>
                      {row.hasUnlinked ? (
                        <form action={approveWeekAction}>
                          <input type="hidden" name="userId" value={row.user.id} />
                          <input type="hidden" name="periodStart" value={periodStart.toISOString()} />
                          <input type="hidden" name="periodEnd" value={periodEnd.toISOString()} />
                          <button type="submit" className="btn-secondary text-xs">
                            Approve week
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-emerald-600">Approved</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            {byUser.every((row) => row.entries.length === 0) ? (
              <tr>
                <td colSpan={canApprove ? 5 : 4} className="text-center text-slate-500 py-6">
                  No time entries this week.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {recentTimesheets.length > 0 ? (
        <div className="card p-4">
          <h2 className="font-medium mb-3">Recently approved</h2>
          <ul className="text-sm divide-y divide-slate-100">
            {recentTimesheets.map((t) => (
              <li key={t.id} className="py-2 flex justify-between">
                <span>
                  {t.user.firstName} {t.user.lastName} — {new Date(t.periodStart).toLocaleDateString()}
                </span>
                <span className="text-slate-500">{t.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
