import { AdminSilenceAlerts } from "@/components/admin-silence-alerts";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.03]">
        <div className="border-b border-zinc-100 px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">
            V<span className="text-zinc-400">|</span>D
          </span>
          <p className="text-xs text-zinc-500">Админ</p>
        </div>
        <AdminSidebarNav />
        <div className="border-t border-zinc-100 p-3">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 xl:p-8">
        <AdminSilenceAlerts />
        {children}
      </main>
    </div>
  );
}
