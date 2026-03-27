import { ExecutorOnboardingGate } from "@/components/executor-onboarding-gate";
import { ExecutorSidebarNav } from "@/components/executor-sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";

export default function ExecutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <ExecutorOnboardingGate />
      <aside className="flex w-60 flex-col border-r border-zinc-200/90 bg-white shadow-sm shadow-zinc-950/[0.03]">
        <div className="border-b border-zinc-100 px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">
            V<span className="text-zinc-400">|</span>D
          </span>
          <p className="text-xs text-zinc-500">Исполнитель</p>
        </div>
        <ExecutorSidebarNav />
        <div className="border-t border-zinc-100 p-3">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
