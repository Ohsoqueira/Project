import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/lib/logout";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <div className="font-bold">ServiceBox</div>
          <div className="text-xs text-slate-400">
            {session.firstName} {session.lastName}
          </div>
        </div>
        <form action={logoutAction}>
          <button className="text-xs underline text-slate-300">Sign out</button>
        </form>
      </header>
      <main className="max-w-lg mx-auto px-3 py-4">{children}</main>
    </div>
  );
}
