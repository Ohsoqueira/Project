"use server";

import { revalidatePath } from "next/cache";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";

// Approves a technician's time entries for a given week: groups any
// not-yet-linked entries in that window into a Timesheet record and marks
// it approved. Editing a reviewed entry keeps it consistent with the WO's
// labour section since TimeEntry rows are shared, not copied (§9.8 US-TIME-3).
export async function approveWeekAction(formData: FormData) {
  const session = await requireCapability("timesheets_approve");
  const userId = String(formData.get("userId"));
  const periodStart = new Date(String(formData.get("periodStart")));
  const periodEnd = new Date(String(formData.get("periodEnd")));

  const [timesheet] = await db
    .insert(schema.timesheets)
    .values({
      userId,
      periodStart,
      periodEnd,
      status: "APPROVED",
      submittedAt: new Date(),
      approvedById: session.userId,
      approvedAt: new Date(),
    })
    .returning();

  await db
    .update(schema.timeEntries)
    .set({ timesheetId: timesheet.id })
    .where(
      and(
        eq(schema.timeEntries.userId, userId),
        isNull(schema.timeEntries.timesheetId),
        gte(schema.timeEntries.startedAt, periodStart),
        lt(schema.timeEntries.startedAt, periodEnd),
      ),
    );

  revalidatePath("/timesheets");
}
