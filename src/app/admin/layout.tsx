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
      <aside className="flex w-[260px] flex-col border-r border-slate-800 bg-slate-800 text-white">
        <div className="border-b border-slate-700 px-5 py-5">
          <span className="text-lg font-semibold tracking-tight text-white">
            V<span className="text-slate-400">|</span>D
          </span>
          <p className="text-xs text-slate-300">Админ</p>
        </div>
        <AdminSidebarNav />
        <div className="border-t border-slate-700 p-3">
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
