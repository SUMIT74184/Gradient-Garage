import { Suspense } from "react";
import { AdminUserProvider } from "@/components/admin/AdminUser";
import Sidebar from "@/components/admin/Sidebar";
import { requireTeam } from "@/lib/auth";

/** Signed-in area: checks the session (inside Suspense, since it reads cookies) and adds the sidebar. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  const user = await requireTeam();
  return (
    <AdminUserProvider user={user}>
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:py-8">{children}</main>
      </div>
    </AdminUserProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row" aria-busy="true">
      <div className="hidden h-screen w-60 shrink-0 border-r border-line bg-stone lg:block" />
      <div className="flex-1 animate-pulse space-y-4 px-8 py-8">
        <div className="h-7 w-64 rounded bg-fg/10" />
        <div className="h-40 rounded-xl bg-fg/5" />
      </div>
    </div>
  );
}
