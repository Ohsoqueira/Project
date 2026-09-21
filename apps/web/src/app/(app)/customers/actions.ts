"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireCapability } from "@/lib/permissions";

export async function createCustomerAction(_prev: { error?: string } | undefined, formData: FormData) {
  const session = await requireCapability("crm_write");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Customer name is required." };

  const [customer] = await db
    .insert(schema.customers)
    .values({
      tenantId: session.tenantId,
      name,
      category: String(formData.get("category") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      billingAddress: String(formData.get("billingAddress") ?? "") || null,
      billingCity: String(formData.get("billingCity") ?? "") || null,
      billingRegion: String(formData.get("billingRegion") ?? "") || null,
    })
    .returning();

  redirect(`/customers/${customer.id}`);
}

export async function updateCustomerAction(
  customerId: string,
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireCapability("crm_write");

  await db
    .update(schema.customers)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      category: String(formData.get("category") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      phone: String(formData.get("phone") ?? "") || null,
      billingAddress: String(formData.get("billingAddress") ?? "") || null,
      billingCity: String(formData.get("billingCity") ?? "") || null,
      billingRegion: String(formData.get("billingRegion") ?? "") || null,
    })
    .where(eq(schema.customers.id, customerId));

  revalidatePath(`/customers/${customerId}`);
  return {};
}

export async function createContactAction(formData: FormData) {
  await requireCapability("crm_write");

  const customerId = String(formData.get("customerId"));
  const jobSiteId = String(formData.get("jobSiteId") ?? "") || null;

  await db.insert(schema.contacts).values({
    customerId,
    jobSiteId,
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    role: String(formData.get("role") ?? "") || null,
    email: String(formData.get("email") ?? "") || null,
    phone: String(formData.get("phone") ?? "") || null,
  });

  revalidatePath(jobSiteId ? `/customers/${customerId}/sites/${jobSiteId}` : `/customers/${customerId}`);
}

export async function createJobSiteAction(formData: FormData) {
  const session = await requireCapability("crm_write");
  void session;

  const customerId = String(formData.get("customerId"));

  const [site] = await db
    .insert(schema.jobSites)
    .values({
      customerId,
      name: String(formData.get("name") ?? "").trim(),
      address: String(formData.get("address") ?? "").trim(),
      city: String(formData.get("city") ?? "") || null,
      region: String(formData.get("region") ?? "") || null,
      accessNotes: String(formData.get("accessNotes") ?? "") || null,
    })
    .returning();

  revalidatePath(`/customers/${customerId}`);
  redirect(`/customers/${customerId}/sites/${site.id}`);
}

export async function createEquipmentAction(formData: FormData) {
  await requireCapability("crm_write");

  const jobSiteId = String(formData.get("jobSiteId"));
  const customerId = String(formData.get("customerId"));

  await db.insert(schema.equipment).values({
    jobSiteId,
    name: String(formData.get("name") ?? "").trim(),
    manufacturer: String(formData.get("manufacturer") ?? "") || null,
    modelNumber: String(formData.get("modelNumber") ?? "") || null,
    serialNumber: String(formData.get("serialNumber") ?? "") || null,
  });

  revalidatePath(`/customers/${customerId}/sites/${jobSiteId}`);
}

export async function createNoteAction(formData: FormData) {
  const session = await requireCapability("crm_read");

  const customerId = String(formData.get("customerId") ?? "") || null;
  const jobSiteId = String(formData.get("jobSiteId") ?? "") || null;
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await db.insert(schema.notes).values({
    customerId,
    jobSiteId,
    body,
    authorId: session.userId,
    visibility: "INTERNAL",
  });

  revalidatePath(jobSiteId ? `/customers/${customerId}/sites/${jobSiteId}` : `/customers/${customerId}`);
}
