import { AdminSilenceAlerts } from "@/components/admin-silence-alerts";
import { AdminMobileBottomNav } from "@/components/admin-mobile-bottom-nav";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { AdminWorkspaceProvider } from "@/components/admin-workspace-provider";
import { ResponsiveAppShell } from "@/components/responsive-app-shell";
import { ExecutorsProvider } from "@/context/executors-context";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ResponsiveAppShell
      variant="admin"
      sidebarNav={<AdminSidebarNav />}
      bottomNav={<AdminMobileBottomNav />}
    >
      <ExecutorsProvider>
        <AdminWorkspaceProvider>
          <AdminSilenceAlerts />
          {children}
        </AdminWorkspaceProvider>
      </ExecutorsProvider>
    </ResponsiveAppShell>
  );
}
