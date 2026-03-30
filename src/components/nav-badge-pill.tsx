"use client";

import { cn } from "@/lib/cn";
import { formatNavBadgeCount } from "@/lib/nav-badges-client";

type NavBadgePillProps = {
  count: number;
  className?: string;
  /** Показывать только при count > 0; анимация при появлении с 0. */
  variant?: "solid" | "muted";
};

export function NavBadgePill({
  count,
  className,
  variant = "solid",
}: NavBadgePillProps) {
  if (count <= 0) return null;
  const label = formatNavBadgeCount(count);
  return (
    <span
      key="nav-badge-on"
      className={cn(
        "vd-nav-badge-in inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums leading-none",
        variant === "solid"
          ? "bg-red-500 text-white shadow-sm"
          : "bg-zinc-200/90 text-zinc-900 dark:bg-zinc-700/90 dark:text-white",
        className,
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}
