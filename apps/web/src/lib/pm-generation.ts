import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema, type AgreementInterval } from "@servicebox/db";
import { nextWorkOrderNumber } from "./numbering";

function addInterval(date: Date, interval: AgreementInterval): Date {
  const d = new Date(date);
  switch (interval) {
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      break;
    case "QUARTERLY":
      d.setMonth(d.getMonth() + 3);
      break;
    case "SEMI_ANNUAL":
      d.setMonth(d.getMonth() + 6);
      break;
    case "ANNUAL":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

// Generates the next work order for every active agreement whose due date
// falls within its lead-day window and hasn't already been generated.
// §9.9: never invents completion, only ever creates the upcoming WO;
// closing it is always a human action (office or field).
export async function generateDueWorkOrders(tenantId: string): Promise<{ generated: number; skipped: number }> {
  const agreements = await db.query.maintenanceAgreements.findMany({
    where: and(eq(schema.maintenanceAgreements.tenantId, tenantId), eq(schema.maintenanceAgreements.active, true)),
    with: { customer: true, jobSite: true, equipment: true },
  });

  const now = new Date();
  let generated = 0;
  let skipped = 0;

  for (const agreement of agreements) {
    let dueDate: Date;

    if (agreement.scheduleFromLastVisit) {
      const lastCompleted = await db.query.workOrders.findFirst({
        where: and(eq(schema.workOrders.agreementId, agreement.id), eq(schema.workOrders.status, "COMPLETE")),
        orderBy: (wo, { desc }) => [desc(wo.completedAt)],
      });
      dueDate = lastCompleted?.completedAt
        ? addInterval(lastCompleted.completedAt, agreement.interval)
        : agreement.lastGeneratedAt
          ? addInterval(agreement.lastGeneratedAt, agreement.interval)
          : agreement.startDate;
    } else {
      dueDate = agreement.lastGeneratedAt ? addInterval(agreement.lastGeneratedAt, agreement.interval) : agreement.startDate;
    }

    const leadWindowStart = new Date(dueDate);
    leadWindowStart.setDate(leadWindowStart.getDate() - agreement.leadDays);

    if (now < leadWindowStart) {
      skipped++;
      continue;
    }

    // Already generated a WO for this exact due cycle (avoid duplicates
    // when this runs more than once inside the same lead window).
    const alreadyGenerated =
      agreement.lastGeneratedAt && Math.abs(agreement.lastGeneratedAt.getTime() - dueDate.getTime()) < 1000;
    if (alreadyGenerated) {
      skipped++;
      continue;
    }

    const number = await nextWorkOrderNumber(tenantId);
    const scheduled = agreement.autoScheduleOnCalendar;

    const [workOrder] = await db
      .insert(schema.workOrders)
      .values({
        tenantId,
        number,
        customerId: agreement.customerId,
        jobSiteId: agreement.jobSiteId,
        agreementId: agreement.id,
        title: agreement.name,
        description: `Recurring maintenance generated from agreement "${agreement.name}".`,
        status: scheduled ? "SCHEDULED" : "UNSCHEDULED",
        scheduledStart: scheduled ? dueDate : null,
      })
      .returning();

    await db.insert(schema.workOrderStatusHistory).values({ workOrderId: workOrder.id, status: workOrder.status });

    if (agreement.equipmentId) {
      await db.insert(schema.workOrderEquipment).values({ workOrderId: workOrder.id, equipmentId: agreement.equipmentId });
    }
    if (agreement.checklistTemplateId) {
      await db.insert(schema.checklistInstances).values({ workOrderId: workOrder.id, templateId: agreement.checklistTemplateId });
    }

    await db.update(schema.maintenanceAgreements).set({ lastGeneratedAt: dueDate }).where(eq(schema.maintenanceAgreements.id, agreement.id));

    generated++;
  }

  return { generated, skipped };
}
