"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";
import { generateDueWorkOrders } from "@/lib/pm-generation";

export async function createAgreementAction(formData: FormData) {
  const session = await requireCapability("workorders_write");

  await db.insert(schema.maintenanceAgreements).values({
    tenantId: session.tenantId,
    customerId: String(formData.get("customerId")),
    jobSiteId: String(formData.get("jobSiteId") ?? "") || null,
    equipmentId: String(formData.get("equipmentId") ?? "") || null,
    name: String(formData.get("name") ?? "").trim(),
    interval: formData.get("interval") as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "SEMI_ANNUAL" | "ANNUAL",
    leadDays: Number(formData.get("leadDays") ?? 14),
    scheduleFromLastVisit: formData.get("scheduleFromLastVisit") === "on",
    autoScheduleOnCalendar: formData.get("autoScheduleOnCalendar") === "on",
    checklistTemplateId: String(formData.get("checklistTemplateId") ?? "") || null,
    startDate: new Date(String(formData.get("startDate"))),
  });

  revalidatePath("/agreements");
}

export async function runGenerationAction() {
  const session = await requireCapability("workorders_write");
  const result = await generateDueWorkOrders(session.tenantId);
  revalidatePath("/agreements");
  revalidatePath("/work-orders");
  return result;
}
