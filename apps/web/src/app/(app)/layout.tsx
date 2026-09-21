import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/logout";
import { can, type Capability } from "@servicebox/shared";

const NAV: { href: string; label: string; capability: Capability | null }[] = [
  { href: "/dashboard", label: "Dashboard", capability: null },
  { href: "/customers", label: "Customers", capability: "crm_read" },
  { href: "/quotes", label: "Quotes", capability: "quotes_write" },
  { href: "/work-orders", label: "Work orders", capability: "workorders_view_all" },
  { href: "/schedule", label: "Scheduler", capability: "workorders_write" },
  { href: "/agreements", label: "Recurring / PM", capability: "workorders_write" },
  { href: "/invoices", label: "Invoices", capability: "invoices_write" },
  { href: "/timesheets", label: "Timesheets", capability: null },
  { href: "/catalog", label: "Catalog", capability: "crm_write" },
  { href: "/reports", label: "Reports", capability: null },
  { href: "/settings", label: "Settings", capability: "manage_settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const items = NAV.filter((item) => !item.capability || can(session.role, item.capability));

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-slate-900 text-slate-200 flex flex-col">
        <div className="px-4 py-4 text-lg font-bold text-white border-b border-slate-800">ServiceBox</div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-slate-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-slate-800 text-sm">
          <div className="font-medium text-white">
            {session.firstName} {session.lastName}
          </div>
          <div className="text-slate-400 text-xs mb-2">{session.role.replace("_", " ")}</div>
          <form action={logoutAction}>
            <button className="text-xs text-slate-400 hover:text-white underline">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
