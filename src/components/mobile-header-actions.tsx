"use client";

import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/theme-toggle";

const compactBtn = "h-9 min-h-9 min-w-9 w-9";

const NotificationCenter = dynamic(
  () =>
    import("@/components/notification-center").then((m) => ({
      default: m.NotificationCenter,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className={`${compactBtn} shrink-0 rounded-lg border border-[color:var(--border)] bg-[var(--card)]`}
        aria-hidden
      />
    ),
  },
);

/** Тема и уведомления в мобильной шапке (компактные кнопки). */
export function MobileHeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <ThemeToggle className={compactBtn} />
      <NotificationCenter triggerClassName={compactBtn} />
    </div>
  );
}
