"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notification-center";

const compactBtn = "h-9 min-h-9 min-w-9 w-9";

/** Тема и уведомления в мобильной шапке (компактные кнопки). */
export function MobileHeaderActions() {
  return (
    <div className="flex items-center gap-1">
      <ThemeToggle className={compactBtn} />
      <NotificationCenter triggerClassName={compactBtn} />
    </div>
  );
}
