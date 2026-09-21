# ServiceBox

A field service management (FSM) rebuild for commercial service contractors
(HVAC, plumbing, electrical, refrigeration, fire/life-safety), scaffolded
from the PRD in this repo. Connects the commercial service workflow:
**Customer → Job site → Equipment → Work order → Invoice**, so office and
field share one operational record instead of rebuilding context at every
handoff.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | `apps/web`, `packages/db`, `packages/shared` |
| App | Next.js 15 (App Router) + TypeScript + Tailwind | Server Components for reads, Server Actions for writes — no separate API layer |
| Database | PostgreSQL + **Drizzle ORM** | See "Why Drizzle, not Prisma" below |
| Auth | Custom JWT session cookie (`jose`) + scrypt password hashing | Tenant-scoped login (company slug + email + password) |
| Scheduler UI | `@dnd-kit/core` | Drag-and-drop day-view board |
| Local infra | `docker-compose.yml` (Postgres, Redis, MinIO) | Redis/MinIO are provisioned for later phases (queues, file storage) but not yet wired into the app |

### Why Drizzle, not Prisma

The PRD's own tech recommendation (§14.1) lists Prisma **or** Drizzle. This
was built in a sandboxed CI-like environment whose egress policy blocks
`binaries.prisma.sh` outright (Prisma downloads native query/schema-engine
binaries at `generate`/`migrate` time). Rather than ship unverified code,
the schema was built in Drizzle, which is pure TypeScript with no native
binaries to fetch — every migration, seed, and query in this repo has
actually been run against a real local Postgres instance. If your
environment doesn't have this restriction, swapping to Prisma against the
same schema shape is a mechanical port.

## Getting started

```bash
cp .env.example apps/web/.env.local   # then edit AUTH_SECRET
docker compose up -d                  # Postgres + Redis + MinIO
pnpm install
pnpm db:generate     # generate SQL migration from packages/db/src/schema.ts (already checked in under packages/db/drizzle/)
pnpm db:migrate      # apply migrations
pnpm db:seed         # demo HVAC tenant, 3 techs, multi-site customer, sample quote/WO
pnpm dev             # http://localhost:3000
```

Demo login: company `demo-hvac`, e.g. `admin@demo-hvac.test` /
`password123` (also `dispatch@`, `tech1@`, `tech2@`, `tech3@`, same
password). Technicians land on the mobile field view (`/today`); everyone
else lands on the office dashboard.

## Architecture

### Record hierarchy (`packages/db/src/schema.ts`)

```
Tenant
├── CompanyLocation (branch)         ─┐
├── InventoryLocation (warehouse/truck)├─ deliberately separate tables (PRD §7.3 hard rule)
├── Customer                          │
│   ├── JobSite (where work happens) ─┘
│   │   └── Equipment
│   ├── Contact (customer- or site-scoped)
│   ├── Quote → WorkOrder → Invoice → Payment
│   └── MaintenanceAgreement (recurring/PM)
├── CatalogItem (labour/service/material) + PriceBook overrides
├── TaxRate / TaxGroup
└── Vendor / PurchaseOrder / InventoryItemBalance (modeled, no UI yet)
```

43 tables total, covering the full data model in PRD §11, including
inventory/purchasing/multi-location tables that exist in the schema but
have no UI in this pass (see "What's deferred" below).

### Auth & permissions

- `apps/web/src/lib/auth.ts`: tenant-scoped login, JWT session cookie
  (`jose`), scrypt password hashing.
- `apps/web/src/middleware.ts`: redirects unauthenticated requests to
  `/login`, and routes technicians to `/today` vs everyone else to
  `/dashboard`.
- `packages/shared/src/permissions.ts`: the role → capability matrix from
  PRD §8.3 (Admin/Office/Dispatcher/Technician/Estimator/Purchasing/
  Billing/ReadOnly). Every server action calls
  `requireCapability(session, capability)` — permission checks live on the
  mutation, not just the UI.
- Field-execution actions (`(tech)/actions.ts`) additionally verify the
  caller is actually an assignee on the work order before allowing any
  write, independent of the capability check.

### Modules implemented (MVP + slices of v1)

- **CRM**: customers, job sites, equipment, contacts (customer- and
  site-scoped), notes.
- **Catalog & tax**: labour/service/material items (archived, not
  deleted, once referenced — pricing history stays immutable per §11.3),
  tax rates and multi-rate tax groups.
- **Quotes**: line items from catalog or custom, status pipeline, convert
  an approved quote to a work order without re-keying scope/materials.
- **Work orders**: status pipeline with history log, multi-technician
  assignment with schedule slots kept separate from "who's responsible",
  line items with job-costing (cost/price/margin, gated behind
  `view_costs`), checklist templates, notes.
- **Scheduler**: drag-and-drop day-view board (unscheduled queue +
  one column per technician).
- **Technician mobile-web view** (`/today`): today's assigned jobs, clock
  in/out (feeds `TimeEntry` + flips WO status), checklist fill-in,
  materials-used logging, notes, touch signature capture.
- **Invoicing**: create from a work order (copies billable lines) or
  standalone, tax computed the same way as quotes, manual payment
  recording with automatic PARTIAL/PAID status.
- **Recurring/PM agreements**: interval + lead-days generation that
  creates the next work order without ever auto-completing anything;
  on-demand button here stands in for a scheduled worker.
- **Timesheets**: weekly time-entry review/approval per technician.
- **Reports**: WO status breakdown, AR snapshot, technician productivity,
  PM compliance.

Every module above was exercised against a live local Postgres instance
during development (not just `tsc`/`next build`) — see the git log for the
specific verification each commit describes.

### What's deferred (per the PRD's own phasing, §15)

- **Native iOS/Android app** (Expo/React Native). The mobile-**web**
  technician view fulfills the PRD's "mobile browser" support path
  (§5); a native app wrapper is a distinct, larger effort.
- **Accounting integrations** (QuickBooks Online/Desktop, Sage 50) — v1
  phase in the PRD.
- **Live payment processing** (Stripe/PayRoc pay links, PCI-scoped card
  capture). What's built is manual payment *recording*, which the PRD
  itself lists as the v1 payments milestone; a real PSP integration needs
  live processor credentials this environment doesn't have.
- **Inventory, purchasing, multi-location UI** — Premium-tier phase in
  the PRD. The tables exist in the schema (`inventoryLocations`,
  `purchaseOrders`, etc.) so this is additive, not a rework.
- **File/photo attachments** — the `Attachment` table exists but nothing
  uploads to the MinIO instance yet; signatures are stored as PNG data
  URLs directly on the `Signature` row as an interim approach.
- **Offline-tolerant mobile writes**, **SMS reminders**, **French
  localization** — all explicitly later-phase in the PRD (§15.3, §16.2).
- **Recurring-generation as a scheduled job**: the generation logic
  (`apps/web/src/lib/pm-generation.ts`) is written as a plain function
  callable on a schedule; a BullMQ worker against the Redis instance in
  `docker-compose.yml` would call it on a cron in production. Only the
  worker wiring itself is missing, not the logic.

## Monorepo layout

```
apps/web/               Next.js app (office + technician UI, server actions)
packages/db/             Drizzle schema, migrations, seed script
packages/shared/         Cross-cutting: permissions matrix, status labels, pricing math
docker-compose.yml       Postgres, Redis, MinIO
```
