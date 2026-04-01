"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  getNavBadgesQueryOptions,
  type NavBadgesPayload,
} from "@/lib/nav-badges-client";
import { NavBadgePill } from "@/components/nav-badge-pill";

const links = [
  { href: "/admin", label: "Главная", icon: IconHome, badge: "notif" as const },
  { href: "/admin/orders", label: "Заказы", icon: IconOrders, badge: "chat" as const },
  { href: "/admin/leads", label: "Лиды", icon: IconUsers, badge: "none" as const },
  { href: "/admin/quick", label: "Создать", icon: IconZap, badge: "none" as const },
] as const;

export function AdminMobileBottomNav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const navOpts = useMemo(
    () => ({
      ...getNavBadgesQueryOptions(queryClient),
      placeholderData: (prev: NavBadgesPayload | undefined) => prev,
    }),
    [queryClient],
  );

  const { data } = useQuery(navOpts);

  const chatC = Math.max(0, Number(data?.unreadChatOrderCount ?? 0));
  const notifC = Math.max(0, Number(data?.notificationUnreadCount ?? 0));

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      className={cn(
        "pointer-events-auto fixed bottom-0 left-0 right-0 z-[100] flex w-full max-w-[100vw] flex-none overflow-visible",
        "border-t border-[color:var(--border)] bg-[var(--card)]/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl",
        "md:hidden dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)]",
        "pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2",
      )}
      aria-label="Нижнее меню"
    >
      {links.map((item) => {
        const badge =
          item.badge === "notif"
            ? notifC
            : item.badge === "chat"
              ? chatC
              : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 pb-0.5 text-[11px] font-medium leading-tight transition-colors duration-150 ease-out",
              "overflow-visible active:scale-[0.98]",
              active(item.href) ? "text-[var(--text)]" : "text-[var(--muted)]",
            )}
          >
            <span className="relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center overflow-visible">
              <item.icon
                className={cn(
                  "h-7 w-7 shrink-0 transition-transform duration-200",
                  active(item.href) ? "text-[var(--text)]" : "text-[var(--muted)]",
                )}
                aria-hidden
              />
              <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex min-h-[18px] min-w-[18px] items-center justify-center">
                <NavBadgePill count={badge} className="h-[18px] min-w-[18px] px-[5px] text-[10px]" />
              </span>
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function IconOrders({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconZap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
    </svg>
  );
}
