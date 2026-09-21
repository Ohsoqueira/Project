// Role/permission matrix from PRD §8.2-8.3. Kept as a single source of
// truth so every server action / route handler checks the same table
// instead of re-deriving role logic ad hoc.

export const ROLE_NAMES = [
  "ADMIN",
  "OFFICE",
  "DISPATCHER",
  "TECHNICIAN",
  "ESTIMATOR",
  "PURCHASING",
  "BILLING",
  "READ_ONLY",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const CAPABILITIES = [
  "manage_users",
  "manage_settings",
  "crm_write",
  "crm_read",
  "quotes_write",
  "workorders_write",
  "workorders_view_all",
  "workorders_capture_assigned",
  "view_costs",
  "invoices_write",
  "payments_write",
  "timesheets_approve",
  "timesheets_submit",
  "accounting_sync",
  "purchasing_write",
  "inventory_write",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

// §8.3 permission matrix (MVP minimum). Each role lists the capabilities it
// holds by default; per-tenant overrides can layer on top later but every
// route must at minimum honor this baseline.
const MATRIX: Record<RoleName, Capability[]> = {
  ADMIN: [...CAPABILITIES],
  OFFICE: [
    "crm_write",
    "crm_read",
    "quotes_write",
    "workorders_write",
    "workorders_view_all",
    "workorders_capture_assigned",
    "invoices_write",
    "payments_write",
    "timesheets_approve",
    "timesheets_submit",
  ],
  DISPATCHER: [
    "crm_write",
    "crm_read",
    "workorders_write",
    "workorders_view_all",
    "workorders_capture_assigned",
    "timesheets_approve",
    "timesheets_submit",
  ],
  TECHNICIAN: ["crm_read", "workorders_capture_assigned", "timesheets_submit"],
  ESTIMATOR: ["crm_read", "quotes_write", "workorders_capture_assigned", "timesheets_submit"],
  PURCHASING: ["crm_read", "purchasing_write", "inventory_write", "timesheets_submit"],
  BILLING: [
    "crm_read",
    "invoices_write",
    "payments_write",
    "accounting_sync",
    "view_costs",
    "timesheets_submit",
  ],
  READ_ONLY: ["crm_read"],
};

export function can(role: RoleName, capability: Capability): boolean {
  return MATRIX[role]?.includes(capability) ?? false;
}

export function capabilitiesFor(role: RoleName): Capability[] {
  return MATRIX[role] ?? [];
}
