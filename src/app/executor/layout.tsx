import { ExecutorOnboardingGate } from "@/components/executor-onboarding-gate";
import { ExecutorSidebarNav } from "@/components/executor-sidebar-nav";
import { ResponsiveAppShell } from "@/components/responsive-app-shell";

export default function ExecutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ExecutorOnboardingGate />
      <ResponsiveAppShell variant="executor" sidebarNav={<ExecutorSidebarNav />}>
        {children}
      </ResponsiveAppShell>
    </>
  );
}
