"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";

async function assertAssigned(workOrderId: string, userId: string) {
  const assignment = await db.query.workOrderAssignees.findFirst({
    where: and(eq(schema.workOrderAssignees.workOrderId, workOrderId), eq(schema.workOrderAssignees.userId, userId)),
  });
  if (!assignment) throw new Error("You are not assigned to this work order.");
}

export async function clockInAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  await assertAssigned(workOrderId, session.userId);

  await db.insert(schema.timeEntries).values({
    userId: session.userId,
    workOrderId,
    timeType: "JOB_LABOUR",
    startedAt: new Date(),
  });

  await db
    .update(schema.workOrders)
    .set({ status: "IN_PROGRESS" })
    .where(and(eq(schema.workOrders.id, workOrderId), eq(schema.workOrders.tenantId, session.tenantId)));
  await db.insert(schema.workOrderStatusHistory).values({ workOrderId, status: "IN_PROGRESS", changedById: session.userId });

  revalidatePath(`/today/${workOrderId}`);
  revalidatePath("/today");
}

export async function clockOutAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  await assertAssigned(workOrderId, session.userId);

  const openEntry = await db.query.timeEntries.findFirst({
    where: and(
      eq(schema.timeEntries.workOrderId, workOrderId),
      eq(schema.timeEntries.userId, session.userId),
      isNull(schema.timeEntries.endedAt),
    ),
    orderBy: (t, { desc }) => [desc(t.startedAt)],
  });

  if (openEntry) {
    await db.update(schema.timeEntries).set({ endedAt: new Date() }).where(eq(schema.timeEntries.id, openEntry.id));
  }

  revalidatePath(`/today/${workOrderId}`);
  revalidatePath("/today");
}

export async function techUpdateStatusAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  const status = formData.get("status") as "WAITING" | "COMPLETE";
  await assertAssigned(workOrderId, session.userId);

  await db
    .update(schema.workOrders)
    .set({ status, ...(status === "COMPLETE" ? { completedAt: new Date() } : {}) })
    .where(and(eq(schema.workOrders.id, workOrderId), eq(schema.workOrders.tenantId, session.tenantId)));
  await db.insert(schema.workOrderStatusHistory).values({ workOrderId, status, changedById: session.userId });

  revalidatePath(`/today/${workOrderId}`);
  revalidatePath("/today");
}

export async function techAddNoteAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await db.insert(schema.notes).values({ workOrderId, body, authorId: session.userId, visibility: "INTERNAL" });
  revalidatePath(`/today/${workOrderId}`);
}

export async function techAddMaterialAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  const catalogItemId = String(formData.get("catalogItemId"));
  const quantity = String(formData.get("quantity") ?? "1");
  await assertAssigned(workOrderId, session.userId);

  const item = await db.query.catalogItems.findFirst({ where: eq(schema.catalogItems.id, catalogItemId) });
  if (!item) throw new Error("Item not found");

  await db.insert(schema.workOrderLines).values({
    workOrderId,
    catalogItemId,
    kind: item.type === "LABOUR" ? "LABOUR" : item.type === "SERVICE" ? "SERVICE" : "MATERIAL",
    description: item.name,
    quantity,
    unitCost: item.unitCost,
    unitPrice: item.unitPrice,
    taxable: item.taxable,
  });

  revalidatePath(`/today/${workOrderId}`);
}

export async function submitSignatureAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const workOrderId = String(formData.get("workOrderId"));
  const signerRole = String(formData.get("signerRole") ?? "customer");
  const signerName = String(formData.get("signerName") ?? "") || null;
  const imageUrl = String(formData.get("imageUrl") ?? "");
  await assertAssigned(workOrderId, session.userId);
  if (!imageUrl) return;

  await db.insert(schema.signatures).values({ workOrderId, signerRole, signerName, imageUrl });
  revalidatePath(`/today/${workOrderId}`);
}

export async function submitChecklistResponseAction(formData: FormData) {
  const session = await requireCapability("workorders_capture_assigned");
  const instanceId = String(formData.get("instanceId"));
  const workOrderId = String(formData.get("workOrderId"));
  await assertAssigned(workOrderId, session.userId);

  const instance = await db.query.checklistInstances.findFirst({
    where: eq(schema.checklistInstances.id, instanceId),
    with: { template: true, responses: true },
  });
  if (!instance) throw new Error("Checklist not found");

  for (const field of instance.template.fields) {
    const raw = formData.get(`field:${field.key}`);
    const value = field.type === "boolean" ? raw === "on" : raw != null ? String(raw) : null;
    const existing = instance.responses.find((r) => r.fieldKey === field.key);
    if (existing) {
      await db.update(schema.checklistItemResponses).set({ value }).where(eq(schema.checklistItemResponses.id, existing.id));
    } else {
      await db.insert(schema.checklistItemResponses).values({ checklistInstanceId: instanceId, fieldKey: field.key, value });
    }
  }

  await db
    .update(schema.checklistInstances)
    .set({ completedAt: new Date(), completedById: session.userId })
    .where(eq(schema.checklistInstances.id, instanceId));

  revalidatePath(`/today/${workOrderId}`);
}
