import { AdminSilenceAlerts } from "@/components/admin-silence-alerts";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { ResponsiveAppShell } from "@/components/responsive-app-shell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ResponsiveAppShell variant="admin" sidebarNav={<AdminSidebarNav />}>
      <AdminSilenceAlerts />
      {children}
    </ResponsiveAppShell>
  );
}
