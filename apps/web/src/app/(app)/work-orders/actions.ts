"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";
import { nextWorkOrderNumber } from "@/lib/numbering";

export async function createWorkOrderAction(formData: FormData) {
  const session = await requireCapability("workorders_write");

  const customerId = String(formData.get("customerId"));
  const jobSiteId = String(formData.get("jobSiteId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "") || null;
  const priority = formData.get("priority") as "LOW" | "NORMAL" | "HIGH" | "URGENT";

  const number = await nextWorkOrderNumber(session.tenantId);

  const [workOrder] = await db
    .insert(schema.workOrders)
    .values({
      tenantId: session.tenantId,
      number,
      customerId,
      jobSiteId,
      title,
      description,
      priority,
      status: "UNSCHEDULED",
      createdById: session.userId,
    })
    .returning();

  await db.insert(schema.workOrderStatusHistory).values({ workOrderId: workOrder.id, status: "UNSCHEDULED" });

  redirect(`/work-orders/${workOrder.id}`);
}

// Status is user-driven, never inferred: a WO only moves to COMPLETE via an
// explicit action from office or field (§9.9 US-PM-6 / §11.3).
export async function updateWorkOrderStatusAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  const status = formData.get("status") as
    | "UNSCHEDULED"
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "WAITING"
    | "COMPLETE"
    | "READY_TO_INVOICE"
    | "CANCELLED";

  const completedAt = status === "COMPLETE" ? new Date() : undefined;

  await db
    .update(schema.workOrders)
    .set({ status, ...(completedAt ? { completedAt } : {}) })
    .where(and(eq(schema.workOrders.id, workOrderId), eq(schema.workOrders.tenantId, session.tenantId)));

  await db.insert(schema.workOrderStatusHistory).values({ workOrderId, status, changedById: session.userId });

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath(`/today`);
}

export async function assignTechnicianAction(formData: FormData) {
  const session = await requireCapability("workorders_write");
  const workOrderId = String(formData.get("workOrderId"));
  const userId = String(formData.get("userId"));
  const scheduledStart = formData.get("scheduledStart") ? new Date(String(formData.get("scheduledStart"))) : null;
  const scheduledEnd = formData.get("scheduledEnd") ? new Date(String(formData.get("scheduledEnd"))) : null;

  await db
    .insert(schema.workOrderAssignees)
    .values({ workOrderId, userId, scheduledStart, scheduledEnd })
    .onConflictDoUpdate({
      target: [schema.workOrderAssignees.workOrderId, schema.workOrderAssignees.userId],
      set: { scheduledStart, scheduledEnd },
    });

  if (scheduledStart) {
    await db
      .update(schema.workOrders)
      .set({ scheduledStart, scheduledEnd, status: "SCHEDULED" })
      .where(and(eq(schema.workOrders.id, workOrderId), eq(schema.workOrders.tenantId, session.tenantId), eq(schema.workOrders.status, "UNSCHEDULED")));
    await db.insert(schema.workOrderStatusHistory).values({ workOrderId, status: "SCHEDULED" });
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath(`/schedule`);
}

export async function removeAssigneeAction(formData: FormData) {
  await requireCapability("workorders_write");
  const id = String(formData.get("assigneeId"));
  const workOrderId = String(formData.get("workOrderId"));
  await db.delete(schema.workOrderAssignees).where(eq(schema.workOrderAssignees.id, id));
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath(`/schedule`);
}

export async function linkEquipmentAction(formData: FormData) {
  await requireCapability("workorders_write");
  const workOrderId = String(formData.get("workOrderId"));
  const equipmentId = String(formData.get("equipmentId"));

  await db.insert(schema.workOrderEquipment).values({ workOrderId, equipmentId }).onConflictDoNothing();
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addWorkOrderLineAction(formData: FormData) {
  await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));

  await db.insert(schema.workOrderLines).values({
    workOrderId,
    catalogItemId: String(formData.get("catalogItemId") ?? "") || null,
    kind: formData.get("kind") as "LABOUR" | "MATERIAL" | "SERVICE",
    description: String(formData.get("description") ?? "").trim(),
    quantity: String(formData.get("quantity") ?? "1"),
    unitCost: String(formData.get("unitCost") ?? "0"),
    unitPrice: String(formData.get("unitPrice") ?? "0"),
    taxable: formData.get("taxable") === "on",
  });

  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function removeWorkOrderLineAction(formData: FormData) {
  await requireCapability("workorders_write");
  const lineId = String(formData.get("lineId"));
  const workOrderId = String(formData.get("workOrderId"));
  await db.delete(schema.workOrderLines).where(eq(schema.workOrderLines.id, lineId));
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addWorkOrderNoteAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await db.insert(schema.notes).values({ workOrderId, body, authorId: session.userId, visibility: "INTERNAL" });
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function applyChecklistTemplateAction(formData: FormData) {
  await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  const templateId = String(formData.get("templateId"));

  await db.insert(schema.checklistInstances).values({ workOrderId, templateId });
  revalidatePath(`/work-orders/${workOrderId}`);
}
