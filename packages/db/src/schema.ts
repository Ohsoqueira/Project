// ServiceBox data model (Drizzle ORM / PostgreSQL).
// Encodes the record hierarchy from the PRD (§7.3, §11):
//   Tenant -> CompanyLocation / InventoryLocation / User
//   Customer -> Contact / JobSite -> Equipment
//   Quote / WorkOrder / Invoice all hang off Customer + optional JobSite/Equipment
// IMPORTANT: companyLocations (branch), jobSites (customer's site) and
// inventoryLocations (warehouse/truck) are intentionally separate tables —
// never conflate them (§7.3 hard rule).

import { createId } from "@paralleldrive/cuid2";
import {
  pgTable,
  pgEnum,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

const id = () => text("id").primaryKey().$defaultFn(() => createId());
const createdAt = () => timestamp("created_at", { mode: "date" }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleNameEnum = pgEnum("role_name", [
  "ADMIN",
  "OFFICE",
  "DISPATCHER",
  "TECHNICIAN",
  "ESTIMATOR",
  "PURCHASING",
  "BILLING",
  "READ_ONLY",
]);

export const catalogItemTypeEnum = pgEnum("catalog_item_type", ["LABOUR", "SERVICE", "MATERIAL", "OTHER"]);

export const quoteStatusEnum = pgEnum("quote_status", ["DRAFT", "SENT", "VIEWED", "APPROVED", "REJECTED", "EXPIRED"]);

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "UNSCHEDULED",
  "SCHEDULED",
  "IN_PROGRESS",
  "WAITING",
  "COMPLETE",
  "READY_TO_INVOICE",
  "CANCELLED",
]);

export const workOrderPriorityEnum = pgEnum("work_order_priority", ["LOW", "NORMAL", "HIGH", "URGENT"]);
export const workOrderLineKindEnum = pgEnum("work_order_line_kind", ["LABOUR", "MATERIAL", "SERVICE"]);
export const noteVisibilityEnum = pgEnum("note_visibility", ["INTERNAL", "CUSTOMER"]);
export const timeTypeEnum = pgEnum("time_type", ["JOB_LABOUR", "TRAVEL", "SHOP", "TRAINING", "OVERTIME", "CUSTOM"]);
export const timesheetStatusEnum = pgEnum("timesheet_status", ["OPEN", "SUBMITTED", "APPROVED", "REJECTED"]);
export const agreementIntervalEnum = pgEnum("agreement_interval", [
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
]);
export const inventoryLocationTypeEnum = pgEnum("inventory_location_type", ["WAREHOUSE", "OFFICE", "VEHICLE", "OTHER"]);
export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "DRAFT",
  "ORDERED",
  "PARTIAL",
  "RECEIVED",
  "CANCELLED",
]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["DRAFT", "SENT", "PARTIAL", "PAID", "VOID"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CARD", "CASH", "CHEQUE", "E_TRANSFER", "OTHER"]);

// ---------------------------------------------------------------------------
// Tenancy, identity
// ---------------------------------------------------------------------------

export const tenants = pgTable("tenants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Toronto"),
  currency: text("currency").notNull().default("CAD"),
  logoUrl: text("logo_url"),
  workOrderCounter: integer("work_order_counter").notNull().default(1000),
  quoteCounter: integer("quote_counter").notNull().default(1000),
  invoiceCounter: integer("invoice_counter").notNull().default(1000),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const companyLocations = pgTable("company_locations", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index("company_locations_tenant_idx").on(t.tenantId) }));

export const users = pgTable("users", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: roleNameEnum("role").notNull().default("TECHNICIAN"),
  active: boolean("active").notNull().default(true),
  phone: text("phone"),
  companyLocationId: text("company_location_id").references(() => companyLocations.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  tenantEmailIdx: uniqueIndex("users_tenant_email_idx").on(t.tenantId, t.email),
}));

// ---------------------------------------------------------------------------
// CRM
// ---------------------------------------------------------------------------

export const taxRates = pgTable("tax_rates", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 6, scale: 4 }).notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => ({ tenantIdx: index("tax_rates_tenant_idx").on(t.tenantId) }));

export const taxGroups = pgTable("tax_groups", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
}, (t) => ({ tenantIdx: index("tax_groups_tenant_idx").on(t.tenantId) }));

export const taxGroupRates = pgTable("tax_group_rates", {
  id: id(),
  taxGroupId: text("tax_group_id").notNull().references(() => taxGroups.id, { onDelete: "cascade" }),
  taxRateId: text("tax_rate_id").notNull().references(() => taxRates.id, { onDelete: "cascade" }),
}, (t) => ({ uniq: uniqueIndex("tax_group_rates_uniq").on(t.taxGroupId, t.taxRateId) }));

export const customers = pgTable("customers", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingRegion: text("billing_region"),
  billingPostal: text("billing_postal"),
  email: text("email"),
  phone: text("phone"),
  defaultTaxGroupId: text("default_tax_group_id").references(() => taxGroups.id),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  tenantIdx: index("customers_tenant_idx").on(t.tenantId),
  tenantNameIdx: index("customers_tenant_name_idx").on(t.tenantId, t.name),
}));

export const jobSites = pgTable("job_sites", {
  id: id(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  region: text("region"),
  postalCode: text("postal_code"),
  accessNotes: text("access_notes"),
  taxGroupId: text("tax_group_id").references(() => taxGroups.id),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({ customerIdx: index("job_sites_customer_idx").on(t.customerId) }));

export const contacts = pgTable("contacts", {
  id: id(),
  customerId: text("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  jobSiteId: text("job_site_id").references(() => jobSites.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role"),
  email: text("email"),
  phone: text("phone"),
  createdAt: createdAt(),
}, (t) => ({
  customerIdx: index("contacts_customer_idx").on(t.customerId),
  jobSiteIdx: index("contacts_job_site_idx").on(t.jobSiteId),
}));

export const equipment = pgTable("equipment", {
  id: id(),
  jobSiteId: text("job_site_id").notNull().references(() => jobSites.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  manufacturer: text("manufacturer"),
  modelNumber: text("model_number"),
  serialNumber: text("serial_number"),
  installedAt: timestamp("installed_at", { mode: "date" }),
  customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
  archived: boolean("archived").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({ jobSiteIdx: index("equipment_job_site_idx").on(t.jobSiteId) }));

// ---------------------------------------------------------------------------
// Catalog / pricing
// ---------------------------------------------------------------------------

export const catalogItems = pgTable("catalog_items", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  code: text("code"),
  name: text("name").notNull(),
  description: text("description"),
  type: catalogItemTypeEnum("type").notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  taxable: boolean("taxable").notNull().default(true),
  trackInventory: boolean("track_inventory").notNull().default(false),
  reorderPoint: integer("reorder_point"),
  active: boolean("active").notNull().default(true),
  lockedAt: timestamp("locked_at", { mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  tenantIdx: index("catalog_items_tenant_idx").on(t.tenantId),
  tenantCodeIdx: uniqueIndex("catalog_items_tenant_code_idx").on(t.tenantId, t.code),
}));

export const priceBookItems = pgTable("price_book_items", {
  id: id(),
  catalogItemId: text("catalog_item_id").notNull().references(() => catalogItems.id, { onDelete: "cascade" }),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  jobSiteId: text("job_site_id").references(() => jobSites.id, { onDelete: "cascade" }),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  createdAt: createdAt(),
}, (t) => ({
  customerIdx: index("price_book_items_customer_idx").on(t.customerId),
  jobSiteIdx: index("price_book_items_job_site_idx").on(t.jobSiteId),
  catalogItemIdx: index("price_book_items_catalog_item_idx").on(t.catalogItemId),
}));

// ---------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------

export const quotes = pgTable("quotes", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  jobSiteId: text("job_site_id").references(() => jobSites.id),
  title: text("title").notNull(),
  status: quoteStatusEnum("status").notNull().default("DRAFT"),
  showPriceBreakdown: boolean("show_price_breakdown").notNull().default(true),
  notes: text("notes"),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  sentAt: timestamp("sent_at", { mode: "date" }),
  respondedAt: timestamp("responded_at", { mode: "date" }),
  expiresAt: timestamp("expires_at", { mode: "date" }),
}, (t) => ({
  tenantIdx: index("quotes_tenant_idx").on(t.tenantId),
  customerIdx: index("quotes_customer_idx").on(t.customerId),
  tenantNumberIdx: uniqueIndex("quotes_tenant_number_idx").on(t.tenantId, t.number),
}));

export const quoteLines = pgTable("quote_lines", {
  id: id(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  catalogItemId: text("catalog_item_id").references(() => catalogItems.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  taxable: boolean("taxable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ quoteIdx: index("quote_lines_quote_idx").on(t.quoteId) }));

export const quoteStatusHistory = pgTable("quote_status_history", {
  id: id(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  status: quoteStatusEnum("status").notNull(),
  changedAt: timestamp("changed_at", { mode: "date" }).notNull().defaultNow(),
  changedById: text("changed_by_id"),
}, (t) => ({ quoteIdx: index("quote_status_history_quote_idx").on(t.quoteId) }));

// ---------------------------------------------------------------------------
// Work orders
// ---------------------------------------------------------------------------

export const workOrders = pgTable("work_orders", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  jobSiteId: text("job_site_id").references(() => jobSites.id),
  quoteId: text("quote_id").references(() => quotes.id),
  agreementId: text("agreement_id").references((): typeof maintenanceAgreements.id => maintenanceAgreements.id),
  title: text("title").notNull(),
  description: text("description"),
  status: workOrderStatusEnum("status").notNull().default("UNSCHEDULED"),
  priority: workOrderPriorityEnum("priority").notNull().default("NORMAL"),
  scheduledStart: timestamp("scheduled_start", { mode: "date" }),
  scheduledEnd: timestamp("scheduled_end", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  tenantIdx: index("work_orders_tenant_idx").on(t.tenantId),
  customerIdx: index("work_orders_customer_idx").on(t.customerId),
  statusIdx: index("work_orders_status_idx").on(t.status),
  tenantNumberIdx: uniqueIndex("work_orders_tenant_number_idx").on(t.tenantId, t.number),
  quoteIdx: uniqueIndex("work_orders_quote_idx").on(t.quoteId),
}));

// Assignment (who's responsible) is deliberately separate from schedule
// slot (when) — §11.3 invariant 1: "assigned ≠ scheduled" but both shown.
export const workOrderAssignees = pgTable("work_order_assignees", {
  id: id(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  scheduledStart: timestamp("scheduled_start", { mode: "date" }),
  scheduledEnd: timestamp("scheduled_end", { mode: "date" }),
  createdAt: createdAt(),
}, (t) => ({
  uniq: uniqueIndex("work_order_assignees_uniq").on(t.workOrderId, t.userId),
  userIdx: index("work_order_assignees_user_idx").on(t.userId),
}));

export const workOrderEquipment = pgTable("work_order_equipment", {
  id: id(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  equipmentId: text("equipment_id").notNull().references(() => equipment.id),
}, (t) => ({ uniq: uniqueIndex("work_order_equipment_uniq").on(t.workOrderId, t.equipmentId) }));

export const workOrderLines = pgTable("work_order_lines", {
  id: id(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  catalogItemId: text("catalog_item_id").references(() => catalogItems.id),
  kind: workOrderLineKindEnum("kind").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  billable: boolean("billable").notNull().default(true),
  taxable: boolean("taxable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ workOrderIdx: index("work_order_lines_work_order_idx").on(t.workOrderId) }));

export const workOrderStatusHistory = pgTable("work_order_status_history", {
  id: id(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  status: workOrderStatusEnum("status").notNull(),
  changedAt: timestamp("changed_at", { mode: "date" }).notNull().defaultNow(),
  changedById: text("changed_by_id"),
}, (t) => ({ workOrderIdx: index("work_order_status_history_work_order_idx").on(t.workOrderId) }));

// ---------------------------------------------------------------------------
// Checklists / forms
// ---------------------------------------------------------------------------

export const checklistTemplates = pgTable("checklist_templates", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  workType: text("work_type"),
  fields: jsonb("fields").$type<Array<{ key: string; label: string; type: string; required: boolean; options?: string[] }>>().notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index("checklist_templates_tenant_idx").on(t.tenantId) }));

export const checklistInstances = pgTable("checklist_instances", {
  id: id(),
  templateId: text("template_id").notNull().references(() => checklistTemplates.id),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  completedById: text("completed_by_id"),
}, (t) => ({ workOrderIdx: index("checklist_instances_work_order_idx").on(t.workOrderId) }));

export const checklistItemResponses = pgTable("checklist_item_responses", {
  id: id(),
  checklistInstanceId: text("checklist_instance_id").notNull().references(() => checklistInstances.id, { onDelete: "cascade" }),
  fieldKey: text("field_key").notNull(),
  value: jsonb("value"),
}, (t) => ({ instanceIdx: index("checklist_item_responses_instance_idx").on(t.checklistInstanceId) }));

// ---------------------------------------------------------------------------
// Time tracking
// ---------------------------------------------------------------------------

export const timesheets = pgTable("timesheets", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  periodStart: timestamp("period_start", { mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
  status: timesheetStatusEnum("status").notNull().default("OPEN"),
  submittedAt: timestamp("submitted_at", { mode: "date" }),
  approvedById: text("approved_by_id").references((): typeof users.id => users.id),
  approvedAt: timestamp("approved_at", { mode: "date" }),
}, (t) => ({ userIdx: index("timesheets_user_idx").on(t.userId) }));

export const timeEntries = pgTable("time_entries", {
  id: id(),
  userId: text("user_id").notNull().references(() => users.id),
  workOrderId: text("work_order_id").references(() => workOrders.id),
  timesheetId: text("timesheet_id").references(() => timesheets.id),
  timeType: timeTypeEnum("time_type").notNull().default("JOB_LABOUR"),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  endedAt: timestamp("ended_at", { mode: "date" }),
  note: text("note"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  createdAt: createdAt(),
}, (t) => ({
  userIdx: index("time_entries_user_idx").on(t.userId),
  workOrderIdx: index("time_entries_work_order_idx").on(t.workOrderId),
}));

// ---------------------------------------------------------------------------
// Signatures, notes, attachments
// ---------------------------------------------------------------------------

export const signatures = pgTable("signatures", {
  id: id(),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id, { onDelete: "cascade" }),
  signerRole: text("signer_role").notNull(),
  signerName: text("signer_name"),
  imageUrl: text("image_url").notNull(),
  createdAt: createdAt(),
}, (t) => ({ workOrderIdx: index("signatures_work_order_idx").on(t.workOrderId) }));

export const notes = pgTable("notes", {
  id: id(),
  visibility: noteVisibilityEnum("visibility").notNull().default("INTERNAL"),
  body: text("body").notNull(),
  authorId: text("author_id").references(() => users.id),
  createdAt: createdAt(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  jobSiteId: text("job_site_id").references(() => jobSites.id, { onDelete: "cascade" }),
  equipmentId: text("equipment_id").references(() => equipment.id, { onDelete: "cascade" }),
  workOrderId: text("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }),
}, (t) => ({
  customerIdx: index("notes_customer_idx").on(t.customerId),
  jobSiteIdx: index("notes_job_site_idx").on(t.jobSiteId),
  equipmentIdx: index("notes_equipment_idx").on(t.equipmentId),
  workOrderIdx: index("notes_work_order_idx").on(t.workOrderId),
}));

export const attachments = pgTable("attachments", {
  id: id(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  createdAt: createdAt(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  jobSiteId: text("job_site_id").references(() => jobSites.id, { onDelete: "cascade" }),
  equipmentId: text("equipment_id").references(() => equipment.id, { onDelete: "cascade" }),
  workOrderId: text("work_order_id").references(() => workOrders.id, { onDelete: "cascade" }),
  quoteId: text("quote_id").references(() => quotes.id, { onDelete: "cascade" }),
}, (t) => ({
  customerIdx: index("attachments_customer_idx").on(t.customerId),
  jobSiteIdx: index("attachments_job_site_idx").on(t.jobSiteId),
  equipmentIdx: index("attachments_equipment_idx").on(t.equipmentId),
  workOrderIdx: index("attachments_work_order_idx").on(t.workOrderId),
  quoteIdx: index("attachments_quote_idx").on(t.quoteId),
}));

// ---------------------------------------------------------------------------
// Preventative maintenance / recurring
// ---------------------------------------------------------------------------

export const maintenanceAgreements = pgTable("maintenance_agreements", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  customerId: text("customer_id").notNull().references(() => customers.id),
  jobSiteId: text("job_site_id").references(() => jobSites.id),
  equipmentId: text("equipment_id").references(() => equipment.id),
  name: text("name").notNull(),
  interval: agreementIntervalEnum("interval").notNull(),
  leadDays: integer("lead_days").notNull().default(14),
  scheduleFromLastVisit: boolean("schedule_from_last_visit").notNull().default(false),
  autoScheduleOnCalendar: boolean("auto_schedule_on_calendar").notNull().default(false),
  checklistTemplateId: text("checklist_template_id").references(() => checklistTemplates.id),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  renewalDate: timestamp("renewal_date", { mode: "date" }),
  active: boolean("active").notNull().default(true),
  lastGeneratedAt: timestamp("last_generated_at", { mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  tenantIdx: index("maintenance_agreements_tenant_idx").on(t.tenantId),
  customerIdx: index("maintenance_agreements_customer_idx").on(t.customerId),
}));

// ---------------------------------------------------------------------------
// Inventory & purchasing (Premium — modeled now, gated by feature flag)
// ---------------------------------------------------------------------------

export const inventoryLocations = pgTable("inventory_locations", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  companyLocationId: text("company_location_id").references(() => companyLocations.id),
  name: text("name").notNull(),
  type: inventoryLocationTypeEnum("type").notNull().default("WAREHOUSE"),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index("inventory_locations_tenant_idx").on(t.tenantId) }));

export const inventoryItemBalances = pgTable("inventory_item_balances", {
  id: id(),
  catalogItemId: text("catalog_item_id").notNull().references(() => catalogItems.id),
  locationId: text("location_id").notNull().references(() => inventoryLocations.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull().default("0"),
}, (t) => ({ uniq: uniqueIndex("inventory_item_balances_uniq").on(t.catalogItemId, t.locationId) }));

export const inventoryTransfers = pgTable("inventory_transfers", {
  id: id(),
  fromLocationId: text("from_location_id").notNull().references(() => inventoryLocations.id),
  toLocationId: text("to_location_id").notNull().references(() => inventoryLocations.id),
  createdAt: createdAt(),
  note: text("note"),
}, (t) => ({
  fromIdx: index("inventory_transfers_from_idx").on(t.fromLocationId),
  toIdx: index("inventory_transfers_to_idx").on(t.toLocationId),
}));

export const inventoryTransferLines = pgTable("inventory_transfer_lines", {
  id: id(),
  transferId: text("transfer_id").notNull().references(() => inventoryTransfers.id, { onDelete: "cascade" }),
  catalogItemId: text("catalog_item_id").notNull().references(() => catalogItems.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
}, (t) => ({ transferIdx: index("inventory_transfer_lines_transfer_idx").on(t.transferId) }));

export const vendors = pgTable("vendors", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  createdAt: createdAt(),
}, (t) => ({ tenantIdx: index("vendors_tenant_idx").on(t.tenantId) }));

export const purchaseOrders = pgTable("purchase_orders", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  vendorId: text("vendor_id").notNull().references(() => vendors.id),
  workOrderId: text("work_order_id").references(() => workOrders.id),
  status: purchaseOrderStatusEnum("status").notNull().default("DRAFT"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  tenantIdx: index("purchase_orders_tenant_idx").on(t.tenantId),
  vendorIdx: index("purchase_orders_vendor_idx").on(t.vendorId),
}));

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: id(),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  catalogItemId: text("catalog_item_id").notNull().references(() => catalogItems.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
}, (t) => ({ poIdx: index("purchase_order_lines_po_idx").on(t.purchaseOrderId) }));

export const receipts = pgTable("receipts", {
  id: id(),
  purchaseOrderId: text("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  locationId: text("location_id").notNull().references(() => inventoryLocations.id),
  receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
}, (t) => ({ poIdx: index("receipts_po_idx").on(t.purchaseOrderId) }));

export const receiptLines = pgTable("receipt_lines", {
  id: id(),
  receiptId: text("receipt_id").notNull().references(() => receipts.id, { onDelete: "cascade" }),
  catalogItemId: text("catalog_item_id").notNull().references(() => catalogItems.id),
  quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
}, (t) => ({ receiptIdx: index("receipt_lines_receipt_idx").on(t.receiptId) }));

// ---------------------------------------------------------------------------
// Invoicing & payments
// ---------------------------------------------------------------------------

export const invoices = pgTable("invoices", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  jobSiteId: text("job_site_id").references(() => jobSites.id),
  workOrderId: text("work_order_id").references(() => workOrders.id),
  status: invoiceStatusEnum("status").notNull().default("DRAFT"),
  dueAt: timestamp("due_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  createdById: text("created_by_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => ({
  tenantIdx: index("invoices_tenant_idx").on(t.tenantId),
  customerIdx: index("invoices_customer_idx").on(t.customerId),
  tenantNumberIdx: uniqueIndex("invoices_tenant_number_idx").on(t.tenantId, t.number),
}));

export const invoiceLines = pgTable("invoice_lines", {
  id: id(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  catalogItemId: text("catalog_item_id").references(() => catalogItems.id),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  taxable: boolean("taxable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
}, (t) => ({ invoiceIdx: index("invoice_lines_invoice_idx").on(t.invoiceId) }));

export const payments = pgTable("payments", {
  id: id(),
  method: paymentMethodEnum("method").notNull().default("CARD"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  receivedAt: timestamp("received_at", { mode: "date" }).notNull().defaultNow(),
  reference: text("reference"),
  recordedById: text("recorded_by_id"),
});

export const paymentAllocations = pgTable("payment_allocations", {
  id: id(),
  paymentId: text("payment_id").notNull().references(() => payments.id, { onDelete: "cascade" }),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
}, (t) => ({
  paymentIdx: index("payment_allocations_payment_idx").on(t.paymentId),
  invoiceIdx: index("payment_allocations_invoice_idx").on(t.invoiceId),
}));

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export const auditLogs = pgTable("audit_logs", {
  id: id(),
  tenantId: text("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  metadata: jsonb("metadata"),
  createdAt: createdAt(),
}, (t) => ({
  tenantIdx: index("audit_logs_tenant_idx").on(t.tenantId),
  entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
}));

// ---------------------------------------------------------------------------
// Relations (for the relational query API: db.query.x.findMany({ with }))
// ---------------------------------------------------------------------------

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  companyLocations: many(companyLocations),
  customers: many(customers),
  catalogItems: many(catalogItems),
  quotes: many(quotes),
  workOrders: many(workOrders),
  invoices: many(invoices),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  companyLocation: one(companyLocations, { fields: [users.companyLocationId], references: [companyLocations.id] }),
  assignments: many(workOrderAssignees),
  timeEntries: many(timeEntries),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  defaultTaxGroup: one(taxGroups, { fields: [customers.defaultTaxGroupId], references: [taxGroups.id] }),
  contacts: many(contacts),
  jobSites: many(jobSites),
  quotes: many(quotes),
  workOrders: many(workOrders),
  invoices: many(invoices),
  agreements: many(maintenanceAgreements),
  notes: many(notes),
}));

export const jobSitesRelations = relations(jobSites, ({ one, many }) => ({
  customer: one(customers, { fields: [jobSites.customerId], references: [customers.id] }),
  taxGroup: one(taxGroups, { fields: [jobSites.taxGroupId], references: [taxGroups.id] }),
  contacts: many(contacts),
  equipment: many(equipment),
  notes: many(notes),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  customer: one(customers, { fields: [contacts.customerId], references: [customers.id] }),
  jobSite: one(jobSites, { fields: [contacts.jobSiteId], references: [jobSites.id] }),
}));

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  jobSite: one(jobSites, { fields: [equipment.jobSiteId], references: [jobSites.id] }),
  notes: many(notes),
  workOrderLinks: many(workOrderEquipment),
  agreements: many(maintenanceAgreements),
}));

export const taxRatesRelations = relations(taxRates, ({ many }) => ({
  groups: many(taxGroupRates),
}));

export const taxGroupsRelations = relations(taxGroups, ({ many }) => ({
  rates: many(taxGroupRates),
  customers: many(customers),
  jobSites: many(jobSites),
}));

export const taxGroupRatesRelations = relations(taxGroupRates, ({ one }) => ({
  taxGroup: one(taxGroups, { fields: [taxGroupRates.taxGroupId], references: [taxGroups.id] }),
  taxRate: one(taxRates, { fields: [taxGroupRates.taxRateId], references: [taxRates.id] }),
}));

export const catalogItemsRelations = relations(catalogItems, ({ one, many }) => ({
  tenant: one(tenants, { fields: [catalogItems.tenantId], references: [tenants.id] }),
  priceBookItems: many(priceBookItems),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [quotes.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [quotes.customerId], references: [customers.id] }),
  jobSite: one(jobSites, { fields: [quotes.jobSiteId], references: [jobSites.id] }),
  lines: many(quoteLines),
  statusHistory: many(quoteStatusHistory),
  workOrder: one(workOrders, { fields: [quotes.id], references: [workOrders.quoteId] }),
}));

export const quoteLinesRelations = relations(quoteLines, ({ one }) => ({
  quote: one(quotes, { fields: [quoteLines.quoteId], references: [quotes.id] }),
  catalogItem: one(catalogItems, { fields: [quoteLines.catalogItemId], references: [catalogItems.id] }),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [workOrders.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [workOrders.customerId], references: [customers.id] }),
  jobSite: one(jobSites, { fields: [workOrders.jobSiteId], references: [jobSites.id] }),
  quote: one(quotes, { fields: [workOrders.quoteId], references: [quotes.id] }),
  agreement: one(maintenanceAgreements, { fields: [workOrders.agreementId], references: [maintenanceAgreements.id] }),
  assignees: many(workOrderAssignees),
  equipmentLinks: many(workOrderEquipment),
  lines: many(workOrderLines),
  statusHistory: many(workOrderStatusHistory),
  checklists: many(checklistInstances),
  timeEntries: many(timeEntries),
  signatures: many(signatures),
  notes: many(notes),
  attachments: many(attachments),
  invoices: many(invoices),
  purchaseOrders: many(purchaseOrders),
}));

export const workOrderAssigneesRelations = relations(workOrderAssignees, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderAssignees.workOrderId], references: [workOrders.id] }),
  user: one(users, { fields: [workOrderAssignees.userId], references: [users.id] }),
}));

export const workOrderEquipmentRelations = relations(workOrderEquipment, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderEquipment.workOrderId], references: [workOrders.id] }),
  equipment: one(equipment, { fields: [workOrderEquipment.equipmentId], references: [equipment.id] }),
}));

export const workOrderLinesRelations = relations(workOrderLines, ({ one }) => ({
  workOrder: one(workOrders, { fields: [workOrderLines.workOrderId], references: [workOrders.id] }),
  catalogItem: one(catalogItems, { fields: [workOrderLines.catalogItemId], references: [catalogItems.id] }),
}));

export const checklistTemplatesRelations = relations(checklistTemplates, ({ many }) => ({
  instances: many(checklistInstances),
}));

export const checklistInstancesRelations = relations(checklistInstances, ({ one, many }) => ({
  template: one(checklistTemplates, { fields: [checklistInstances.templateId], references: [checklistTemplates.id] }),
  workOrder: one(workOrders, { fields: [checklistInstances.workOrderId], references: [workOrders.id] }),
  responses: many(checklistItemResponses),
}));

export const checklistItemResponsesRelations = relations(checklistItemResponses, ({ one }) => ({
  instance: one(checklistInstances, { fields: [checklistItemResponses.checklistInstanceId], references: [checklistInstances.id] }),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  user: one(users, { fields: [timeEntries.userId], references: [users.id] }),
  workOrder: one(workOrders, { fields: [timeEntries.workOrderId], references: [workOrders.id] }),
  timesheet: one(timesheets, { fields: [timeEntries.timesheetId], references: [timesheets.id] }),
}));

export const timesheetsRelations = relations(timesheets, ({ one, many }) => ({
  user: one(users, { fields: [timesheets.userId], references: [users.id] }),
  approvedBy: one(users, { fields: [timesheets.approvedById], references: [users.id] }),
  entries: many(timeEntries),
}));

export const maintenanceAgreementsRelations = relations(maintenanceAgreements, ({ one, many }) => ({
  tenant: one(tenants, { fields: [maintenanceAgreements.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [maintenanceAgreements.customerId], references: [customers.id] }),
  jobSite: one(jobSites, { fields: [maintenanceAgreements.jobSiteId], references: [jobSites.id] }),
  equipment: one(equipment, { fields: [maintenanceAgreements.equipmentId], references: [equipment.id] }),
  checklistTemplate: one(checklistTemplates, { fields: [maintenanceAgreements.checklistTemplateId], references: [checklistTemplates.id] }),
  workOrders: many(workOrders),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [invoices.customerId], references: [customers.id] }),
  jobSite: one(jobSites, { fields: [invoices.jobSiteId], references: [jobSites.id] }),
  workOrder: one(workOrders, { fields: [invoices.workOrderId], references: [workOrders.id] }),
  lines: many(invoiceLines),
  allocations: many(paymentAllocations),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
  catalogItem: one(catalogItems, { fields: [invoiceLines.catalogItemId], references: [catalogItems.id] }),
}));

export const paymentsRelations = relations(payments, ({ many }) => ({
  allocations: many(paymentAllocations),
}));

export const paymentAllocationsRelations = relations(paymentAllocations, ({ one }) => ({
  payment: one(payments, { fields: [paymentAllocations.paymentId], references: [payments.id] }),
  invoice: one(invoices, { fields: [paymentAllocations.invoiceId], references: [invoices.id] }),
}));

export const signaturesRelations = relations(signatures, ({ one }) => ({
  workOrder: one(workOrders, { fields: [signatures.workOrderId], references: [workOrders.id] }),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  customer: one(customers, { fields: [attachments.customerId], references: [customers.id] }),
  jobSite: one(jobSites, { fields: [attachments.jobSiteId], references: [jobSites.id] }),
  equipment: one(equipment, { fields: [attachments.equipmentId], references: [equipment.id] }),
  workOrder: one(workOrders, { fields: [attachments.workOrderId], references: [workOrders.id] }),
  quote: one(quotes, { fields: [attachments.quoteId], references: [quotes.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, { fields: [notes.authorId], references: [users.id] }),
  customer: one(customers, { fields: [notes.customerId], references: [customers.id] }),
  jobSite: one(jobSites, { fields: [notes.jobSiteId], references: [jobSites.id] }),
  equipment: one(equipment, { fields: [notes.equipmentId], references: [equipment.id] }),
  workOrder: one(workOrders, { fields: [notes.workOrderId], references: [workOrders.id] }),
}));

export const vendorsRelations = relations(vendors, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  vendor: one(vendors, { fields: [purchaseOrders.vendorId], references: [vendors.id] }),
  workOrder: one(workOrders, { fields: [purchaseOrders.workOrderId], references: [workOrders.id] }),
  lines: many(purchaseOrderLines),
  receipts: many(receipts),
}));

export const inventoryLocationsRelations = relations(inventoryLocations, ({ one, many }) => ({
  companyLocation: one(companyLocations, { fields: [inventoryLocations.companyLocationId], references: [companyLocations.id] }),
  balances: many(inventoryItemBalances),
}));

// ---------------------------------------------------------------------------
// Convenience type exports
// ---------------------------------------------------------------------------

export type RoleName = (typeof roleNameEnum.enumValues)[number];
export type WorkOrderStatus = (typeof workOrderStatusEnum.enumValues)[number];
export type QuoteStatus = (typeof quoteStatusEnum.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number];
export type AgreementInterval = (typeof agreementIntervalEnum.enumValues)[number];

export const schema = {
  tenants,
  companyLocations,
  users,
  taxRates,
  taxGroups,
  taxGroupRates,
  customers,
  jobSites,
  contacts,
  equipment,
  catalogItems,
  priceBookItems,
  quotes,
  quoteLines,
  quoteStatusHistory,
  workOrders,
  workOrderAssignees,
  workOrderEquipment,
  workOrderLines,
  workOrderStatusHistory,
  checklistTemplates,
  checklistInstances,
  checklistItemResponses,
  timesheets,
  timeEntries,
  signatures,
  notes,
  attachments,
  maintenanceAgreements,
  inventoryLocations,
  inventoryItemBalances,
  inventoryTransfers,
  inventoryTransferLines,
  vendors,
  purchaseOrders,
  purchaseOrderLines,
  receipts,
  receiptLines,
  invoices,
  invoiceLines,
  payments,
  paymentAllocations,
  auditLogs,
  tenantsRelations,
  usersRelations,
  customersRelations,
  jobSitesRelations,
  contactsRelations,
  equipmentRelations,
  taxRatesRelations,
  taxGroupsRelations,
  taxGroupRatesRelations,
  catalogItemsRelations,
  quotesRelations,
  quoteLinesRelations,
  workOrdersRelations,
  workOrderAssigneesRelations,
  workOrderEquipmentRelations,
  workOrderLinesRelations,
  checklistTemplatesRelations,
  checklistInstancesRelations,
  checklistItemResponsesRelations,
  timeEntriesRelations,
  timesheetsRelations,
  maintenanceAgreementsRelations,
  invoicesRelations,
  invoiceLinesRelations,
  paymentsRelations,
  paymentAllocationsRelations,
  notesRelations,
  signaturesRelations,
  attachmentsRelations,
  vendorsRelations,
  purchaseOrdersRelations,
  inventoryLocationsRelations,
};
