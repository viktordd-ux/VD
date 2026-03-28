import { AdminSilenceAlerts } from "@/components/admin-silence-alerts";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { ResponsiveAppShell } from "@/components/responsive-app-shell";
import { ExecutorsProvider } from "@/context/executors-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ResponsiveAppShell variant="admin" sidebarNav={<AdminSidebarNav />}>
      <ExecutorsProvider>
        <AdminSilenceAlerts />
        {children}
      </ExecutorsProvider>
    </ResponsiveAppShell>
  );
}
