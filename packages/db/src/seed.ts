import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import { scryptSync, randomBytes } from "node:crypto";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL ?? "postgresql://servicebox:servicebox@localhost:5432/servicebox", {
  max: 1,
});
const db = drizzle(client, { schema });

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const [existing] = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, "demo-hvac"));
  if (existing) {
    console.log("Demo tenant already seeded, skipping.");
    return;
  }

  const [tenant] = await db
    .insert(schema.tenants)
    .values({ slug: "demo-hvac", name: "Demo HVAC & Mechanical Ltd.", timezone: "America/Toronto", currency: "CAD" })
    .returning();

  const [location] = await db
    .insert(schema.companyLocations)
    .values({ tenantId: tenant.id, name: "Head Office", city: "Regina", region: "SK", isPrimary: true })
    .returning();

  const [inventoryLocation] = await db
    .insert(schema.inventoryLocations)
    .values({ tenantId: tenant.id, companyLocationId: location.id, name: "Main Warehouse", type: "WAREHOUSE" })
    .returning();

  const [admin, dispatcher, tech1, tech2, tech3] = await db
    .insert(schema.users)
    .values([
      {
        tenantId: tenant.id,
        email: "admin@demo-hvac.test",
        passwordHash: hashPassword("password123"),
        firstName: "Alex",
        lastName: "Admin",
        role: "ADMIN",
        companyLocationId: location.id,
      },
      {
        tenantId: tenant.id,
        email: "dispatch@demo-hvac.test",
        passwordHash: hashPassword("password123"),
        firstName: "Dana",
        lastName: "Dispatcher",
        role: "DISPATCHER",
        companyLocationId: location.id,
      },
      {
        tenantId: tenant.id,
        email: "tech1@demo-hvac.test",
        passwordHash: hashPassword("password123"),
        firstName: "Tom",
        lastName: "Tech",
        role: "TECHNICIAN",
        companyLocationId: location.id,
      },
      {
        tenantId: tenant.id,
        email: "tech2@demo-hvac.test",
        passwordHash: hashPassword("password123"),
        firstName: "Priya",
        lastName: "Field",
        role: "TECHNICIAN",
        companyLocationId: location.id,
      },
      {
        tenantId: tenant.id,
        email: "tech3@demo-hvac.test",
        passwordHash: hashPassword("password123"),
        firstName: "Sam",
        lastName: "Wrench",
        role: "TECHNICIAN",
        companyLocationId: location.id,
      },
    ])
    .returning();

  const [gst] = await db.insert(schema.taxRates).values({ tenantId: tenant.id, name: "GST", rate: "0.05" }).returning();
  const [pst] = await db
    .insert(schema.taxRates)
    .values({ tenantId: tenant.id, name: "PST (SK)", rate: "0.06" })
    .returning();
  const [taxGroup] = await db
    .insert(schema.taxGroups)
    .values({ tenantId: tenant.id, name: "Saskatchewan GST+PST" })
    .returning();
  await db.insert(schema.taxGroupRates).values([
    { taxGroupId: taxGroup.id, taxRateId: gst.id },
    { taxGroupId: taxGroup.id, taxRateId: pst.id },
  ]);

  const [labourItem, filterItem, thermostatItem] = await db
    .insert(schema.catalogItems)
    .values([
      {
        tenantId: tenant.id,
        code: "LAB-STD",
        name: "Standard Labour (hourly)",
        type: "LABOUR",
        unitCost: "35",
        unitPrice: "95",
        taxable: true,
      },
      {
        tenantId: tenant.id,
        code: "MAT-FILTER-20x25",
        name: "Furnace Filter 20x25x1",
        type: "MATERIAL",
        unitCost: "8",
        unitPrice: "22",
        taxable: true,
        trackInventory: true,
        reorderPoint: 10,
      },
      {
        tenantId: tenant.id,
        code: "MAT-TSTAT-SMART",
        name: "Smart Programmable Thermostat",
        type: "MATERIAL",
        unitCost: "140",
        unitPrice: "285",
        taxable: true,
        trackInventory: true,
        reorderPoint: 3,
      },
    ])
    .returning();

  await db.insert(schema.catalogItems).values({
    tenantId: tenant.id,
    code: "SVC-PM-RTU",
    name: "RTU Preventative Maintenance Visit",
    type: "SERVICE",
    unitCost: "0",
    unitPrice: "225",
    taxable: true,
  });

  await db.insert(schema.inventoryItemBalances).values([
    { catalogItemId: filterItem.id, locationId: inventoryLocation.id, quantity: "40" },
    { catalogItemId: thermostatItem.id, locationId: inventoryLocation.id, quantity: "6" },
  ]);

  const [customer] = await db
    .insert(schema.customers)
    .values({
      tenantId: tenant.id,
      name: "Prairie Retail Group",
      category: "Commercial - Retail",
      email: "ap@prairieretail.test",
      phone: "306-555-0100",
      defaultTaxGroupId: taxGroup.id,
      billingAddress: "100 Main St",
      billingCity: "Regina",
      billingRegion: "SK",
    })
    .returning();

  await db.insert(schema.contacts).values({
    customerId: customer.id,
    firstName: "Jordan",
    lastName: "Pay",
    role: "Billing",
    email: "ap@prairieretail.test",
  });

  const [site1] = await db
    .insert(schema.jobSites)
    .values({
      customerId: customer.id,
      name: "Prairie Retail - Downtown",
      address: "100 Main St",
      city: "Regina",
      region: "SK",
      accessNotes: "Roof access via rear stairwell, ask for manager on duty for key.",
    })
    .returning();

  const [site2] = await db
    .insert(schema.jobSites)
    .values({
      customerId: customer.id,
      name: "Prairie Retail - North Mall",
      address: "455 North Mall Blvd",
      city: "Regina",
      region: "SK",
      accessNotes: "Loading dock entrance, security desk has master key.",
    })
    .returning();

  await db.insert(schema.contacts).values({
    customerId: customer.id,
    jobSiteId: site1.id,
    firstName: "Morgan",
    lastName: "Manager",
    role: "Site contact",
    phone: "306-555-0110",
  });

  const [rtu1] = await db
    .insert(schema.equipment)
    .values({
      jobSiteId: site1.id,
      name: "Rooftop Unit 1 (Sales Floor)",
      manufacturer: "Carrier",
      modelNumber: "48TC-D08",
      serialNumber: "SN-RTU1-2019",
      installedAt: new Date("2019-05-01"),
      customFields: { tonnage: "7.5", refrigerant: "R-410A" },
    })
    .returning();

  await db.insert(schema.equipment).values({
    jobSiteId: site2.id,
    name: "Rooftop Unit A (Mall Court)",
    manufacturer: "Trane",
    modelNumber: "TCD120",
    serialNumber: "SN-RTUA-2021",
    installedAt: new Date("2021-08-15"),
    customFields: { tonnage: "10", refrigerant: "R-410A" },
  });

  const quoteNumber = tenant.quoteCounter;
  const [quote] = await db
    .insert(schema.quotes)
    .values({
      tenantId: tenant.id,
      number: quoteNumber,
      customerId: customer.id,
      jobSiteId: site1.id,
      title: "Thermostat upgrade - Sales Floor RTU",
      status: "APPROVED",
      sentAt: new Date(),
      respondedAt: new Date(),
    })
    .returning();

  await db.insert(schema.quoteLines).values([
    { quoteId: quote.id, catalogItemId: thermostatItem.id, description: thermostatItem.name, quantity: "1", unitPrice: "285" },
    { quoteId: quote.id, catalogItemId: labourItem.id, description: "Install + commission", quantity: "2", unitPrice: "95" },
  ]);
  await db.insert(schema.quoteStatusHistory).values([
    { quoteId: quote.id, status: "DRAFT" },
    { quoteId: quote.id, status: "SENT" },
    { quoteId: quote.id, status: "APPROVED" },
  ]);
  await db.update(schema.tenants).set({ quoteCounter: quoteNumber + 1 }).where(eq(schema.tenants.id, tenant.id));

  const workOrderNumber = tenant.workOrderCounter;
  const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const scheduledEnd = new Date(Date.now() + 26 * 60 * 60 * 1000);
  const [workOrder] = await db
    .insert(schema.workOrders)
    .values({
      tenantId: tenant.id,
      number: workOrderNumber,
      customerId: customer.id,
      jobSiteId: site1.id,
      quoteId: quote.id,
      title: "Thermostat upgrade - Sales Floor RTU",
      description: "Replace analog thermostat with smart programmable unit per approved quote.",
      status: "SCHEDULED",
      scheduledStart,
      scheduledEnd,
    })
    .returning();

  await db.insert(schema.workOrderAssignees).values({
    workOrderId: workOrder.id,
    userId: tech1.id,
    scheduledStart,
    scheduledEnd,
  });
  await db.insert(schema.workOrderEquipment).values({ workOrderId: workOrder.id, equipmentId: rtu1.id });
  await db.insert(schema.workOrderLines).values([
    { workOrderId: workOrder.id, catalogItemId: thermostatItem.id, kind: "MATERIAL", description: thermostatItem.name, quantity: "1", unitCost: "140", unitPrice: "285" },
    { workOrderId: workOrder.id, catalogItemId: labourItem.id, kind: "LABOUR", description: "Install + commission", quantity: "2", unitCost: "35", unitPrice: "95" },
  ]);
  await db.insert(schema.workOrderStatusHistory).values([
    { workOrderId: workOrder.id, status: "UNSCHEDULED" },
    { workOrderId: workOrder.id, status: "SCHEDULED" },
  ]);
  await db.update(schema.tenants).set({ workOrderCounter: workOrderNumber + 1 }).where(eq(schema.tenants.id, tenant.id));

  await db.insert(schema.maintenanceAgreements).values({
    tenantId: tenant.id,
    customerId: customer.id,
    jobSiteId: site2.id,
    name: "North Mall RTU Quarterly PM",
    interval: "QUARTERLY",
    leadDays: 14,
    startDate: new Date(),
    active: true,
  });

  const [checklist] = await db
    .insert(schema.checklistTemplates)
    .values({
      tenantId: tenant.id,
      name: "RTU Preventative Maintenance Checklist",
      workType: "PM",
      fields: [
        { key: "filters_replaced", label: "Filters replaced", type: "boolean", required: true },
        { key: "refrigerant_charge_ok", label: "Refrigerant charge OK", type: "boolean", required: true },
        { key: "belt_condition", label: "Belt condition notes", type: "text", required: false },
        { key: "amp_draw_reading", label: "Amp draw reading", type: "number", required: false },
      ],
    })
    .returning();

  console.log("Seed complete.");
  console.log(`Tenant: ${tenant.name} (${tenant.slug})`);
  console.log("Login (any user): password123");
  console.log([admin, dispatcher, tech1, tech2, tech3].map((u) => u.email).join("\n"));
  console.log(`Checklist template seeded: ${checklist.name}`);
  console.log(`Sample work order #${workOrder.number}, quote #${quote.number}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
