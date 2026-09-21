"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";

// Plain-argument variant of the assignment action, meant to be invoked
// directly from a client component after a drag-and-drop drop (building a
// FormData for a pointer event is awkward, so this bypasses that).
export async function reassignWorkOrderAction(input: {
  workOrderId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  startHour?: number;
  endHour?: number;
}) {
  const session = await requireCapability("workorders_write");
  const startHour = input.startHour ?? 9;
  const endHour = input.endHour ?? 11;

  const scheduledStart = new Date(`${input.date}T00:00:00`);
  scheduledStart.setHours(startHour, 0, 0, 0);
  const scheduledEnd = new Date(`${input.date}T00:00:00`);
  scheduledEnd.setHours(endHour, 0, 0, 0);

  await db.delete(schema.workOrderAssignees).where(eq(schema.workOrderAssignees.workOrderId, input.workOrderId));
  await db.insert(schema.workOrderAssignees).values({
    workOrderId: input.workOrderId,
    userId: input.userId,
    scheduledStart,
    scheduledEnd,
  });

  await db
    .update(schema.workOrders)
    .set({ scheduledStart, scheduledEnd, status: "SCHEDULED" })
    .where(and(eq(schema.workOrders.id, input.workOrderId), eq(schema.workOrders.tenantId, session.tenantId)));

  await db.insert(schema.workOrderStatusHistory).values({ workOrderId: input.workOrderId, status: "SCHEDULED" });

  revalidatePath("/schedule");
  revalidatePath(`/work-orders/${input.workOrderId}`);
}

export async function unscheduleWorkOrderAction(workOrderId: string) {
  const session = await requireCapability("workorders_write");

  await db.delete(schema.workOrderAssignees).where(eq(schema.workOrderAssignees.workOrderId, workOrderId));
  await db
    .update(schema.workOrders)
    .set({ scheduledStart: null, scheduledEnd: null, status: "UNSCHEDULED" })
    .where(and(eq(schema.workOrders.id, workOrderId), eq(schema.workOrders.tenantId, session.tenantId)));
  await db.insert(schema.workOrderStatusHistory).values({ workOrderId, status: "UNSCHEDULED" });

  revalidatePath("/schedule");
  revalidatePath(`/work-orders/${workOrderId}`);
}
