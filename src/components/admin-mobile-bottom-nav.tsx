"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { queryKeys } from "@/lib/query-keys";

const links = [
  { href: "/admin", label: "Главная", icon: IconHome },
  { href: "/admin/orders", label: "Заказы", icon: IconOrders },
  { href: "/admin/leads", label: "Лиды", icon: IconUsers },
  { href: "/admin/quick", label: "Создать", icon: IconZap },
] as const;

async function fetchNavBadges() {
  const res = await fetch("/api/orders/unread", { cache: "no-store" });
  if (!res.ok) throw new Error("badges");
  return res.json() as Promise<{
    global?: {
      unreadChatOrderCount?: number;
      notificationUnreadCount?: number;
    };
  }>;
}

export function AdminMobileBottomNav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.navBadges(),
    queryFn: fetchNavBadges,
    staleTime: 15_000,
  });

  const g = data?.global;
  const chatC = Math.max(0, Number(g?.unreadChatOrderCount ?? 0));
  const notifC = Math.max(0, Number(g?.notificationUnreadCount ?? 0));
  const totalBadge = chatC + notifC;

  useEffect(() => {
    const inv = () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    window.addEventListener("vd:order-unread-changed", inv);
    window.addEventListener("vd:notifications-changed", inv);
    return () => {
      window.removeEventListener("vd:order-unread-changed", inv);
      window.removeEventListener("vd:notifications-changed", inv);
    };
  }, [queryClient]);

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 z-50 flex w-full max-w-[100vw] border-t border-[color:var(--border)] bg-[var(--card)]/95 pb-[calc(0.65rem+env(safe-area-inset-bottom,0px))] pt-2.5 backdrop-blur-md md:hidden"
      aria-label="Нижнее меню"
    >
      {links.map((item, index) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          className={cn(
            "relative flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-all duration-150 ease-out active:scale-[0.97]",
            active(item.href) ? "text-[var(--text)]" : "text-[var(--muted)]",
          )}
        >
          <span className="relative inline-flex">
            <item.icon
              className={cn(
                "h-7 w-7",
                active(item.href) ? "text-[var(--text)]" : "text-[var(--muted)]",
              )}
            />
            {index === 0 && totalBadge > 0 ? (
              <span className="absolute -right-2 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-[5px] text-[10px] font-bold leading-none text-white">
                {totalBadge > 99 ? "99+" : totalBadge}
              </span>
            ) : null}
          </span>
          {item.label}
        </Link>
      ))}
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
