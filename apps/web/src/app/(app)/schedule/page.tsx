import Link from "next/link";
import { and, eq, gte, isNull, lt, or } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { ScheduleBoard } from "./schedule-board";
import { DatePicker } from "./date-picker";

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await requireSession();
  const { date } = await searchParams;
  const selectedDate = date ?? toDateInputValue(new Date());

  const dayStart = new Date(`${selectedDate}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const prevDate = new Date(dayStart);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(dayStart);
  nextDate.setDate(nextDate.getDate() + 1);

  const [technicians, scheduledJobs, unscheduledJobs] = await Promise.all([
    db.query.users.findMany({
      where: and(eq(schema.users.tenantId, session.tenantId), eq(schema.users.active, true), eq(schema.users.role, "TECHNICIAN")),
      orderBy: (u, { asc }) => [asc(u.firstName)],
    }),
    db.query.workOrders.findMany({
      where: and(
        eq(schema.workOrders.tenantId, session.tenantId),
        gte(schema.workOrders.scheduledStart, dayStart),
        lt(schema.workOrders.scheduledStart, dayEnd),
      ),
      with: { customer: true, assignees: true },
    }),
    db.query.workOrders.findMany({
      where: and(
        eq(schema.workOrders.tenantId, session.tenantId),
        eq(schema.workOrders.status, "UNSCHEDULED"),
        or(isNull(schema.workOrders.scheduledStart)),
      ),
      with: { customer: true },
      limit: 30,
    }),
  ]);

  const toCard = (wo: (typeof scheduledJobs)[number] | (typeof unscheduledJobs)[number]) => ({
    id: wo.id,
    number: wo.number,
    title: wo.title,
    priority: wo.priority,
    customerName: wo.customer.name,
    scheduledStart: wo.scheduledStart ? wo.scheduledStart.toISOString() : null,
    scheduledEnd: wo.scheduledEnd ? wo.scheduledEnd.toISOString() : null,
  });

  const techBoards = technicians.map((tech) => ({
    id: tech.id,
    name: `${tech.firstName} ${tech.lastName}`,
    jobs: scheduledJobs.filter((wo) => wo.assignees.some((a) => a.userId === tech.id)).map(toCard),
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Scheduler</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/schedule?date=${toDateInputValue(prevDate)}`} className="btn-secondary">
            &larr; Prev
          </Link>
          <DatePicker date={selectedDate} />
          <Link href={`/schedule?date=${toDateInputValue(nextDate)}`} className="btn-secondary">
            Next &rarr;
          </Link>
        </div>
      </div>
      <p className="text-sm text-slate-500">
        Drag a job onto a technician to assign and schedule it for {selectedDate} (default 9am–11am slot — adjust exact
        times from the work order detail page). Drag onto &ldquo;Unscheduled queue&rdquo; to remove scheduling.
      </p>
      <ScheduleBoard date={selectedDate} technicians={techBoards} unscheduled={unscheduledJobs.map(toCard)} />
    </div>
  );
}
