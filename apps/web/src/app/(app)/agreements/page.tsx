import { eq } from "drizzle-orm";
import { db, schema } from "@servicebox/db";
import { requireSession } from "@/lib/auth";
import { NewAgreementForm } from "./new-agreement-form";
import { RunGenerationButton } from "./run-generation-button";

const INTERVAL_LABELS: Record<string, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMI_ANNUAL: "Semi-annual",
  ANNUAL: "Annual",
};

export default async function AgreementsPage() {
  const session = await requireSession();

  const [agreements, customers, checklistTemplates] = await Promise.all([
    db.query.maintenanceAgreements.findMany({
      where: eq(schema.maintenanceAgreements.tenantId, session.tenantId),
      with: { customer: true, jobSite: true, equipment: true },
      orderBy: (a, { asc }) => [asc(a.name)],
    }),
    db.query.customers.findMany({
      where: eq(schema.customers.tenantId, session.tenantId),
      with: { jobSites: { with: { equipment: true } } },
      orderBy: (c, { asc }) => [asc(c.name)],
    }),
    db.query.checklistTemplates.findMany({ where: eq(schema.checklistTemplates.tenantId, session.tenantId) }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Recurring / PM agreements</h1>
      </div>

      <div className="card p-4">
        <p className="text-sm text-slate-600 mb-3">
          Generation never auto-completes a job — it only creates the upcoming work order within each agreement&rsquo;s
          lead-day window. In production this same check runs on a schedule (a BullMQ worker against the Redis
          instance in docker-compose); this button runs it on demand for the demo.
        </p>
        <RunGenerationButton />
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Customer / site</th>
              <th>Interval</th>
              <th>Lead days</th>
              <th>Last generated</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {agreements.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>
                  {a.customer.name}
                  {a.jobSite ? ` — ${a.jobSite.name}` : ""}
                  {a.equipment ? ` (${a.equipment.name})` : ""}
                </td>
                <td>{INTERVAL_LABELS[a.interval]}</td>
                <td>{a.leadDays}</td>
                <td>{a.lastGeneratedAt ? new Date(a.lastGeneratedAt).toLocaleDateString() : "Never"}</td>
                <td>{a.active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {agreements.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-slate-500 py-6">
                  No agreements yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="font-medium mb-3">New agreement</h2>
        {customers.length === 0 ? (
          <p className="text-sm text-slate-500">Add a customer first.</p>
        ) : (
          <NewAgreementForm customers={customers} checklistTemplates={checklistTemplates} />
        )}
      </div>
    </div>
  );
}
