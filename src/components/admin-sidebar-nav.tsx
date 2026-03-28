"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";
import { cn } from "@/lib/cn";

type Badges = { review: number; newLeads: number; overdue: number };

const items: {
  href: string;
  label: string;
  badgeKey?: keyof Badges;
  icon: (props: { className?: string }) => ReactNode;
}[] = [
  { href: "/admin", label: "Дашборд", icon: IconLayout },
  { href: "/admin/orders", label: "Заказы", badgeKey: "review", icon: IconOrders },
  { href: "/admin/leads", label: "Лиды", badgeKey: "newLeads", icon: IconUsers },
  { href: "/admin/quick", label: "Быстро создать", icon: IconZap },
  { href: "/admin/users", label: "Исполнители", icon: IconUserCog },
  { href: "/admin/templates", label: "Шаблоны", icon: IconTemplate },
  { href: "/admin/risks", label: "Риски", badgeKey: "overdue", icon: IconAlert },
  { href: "/admin/finance", label: "Финансы", icon: IconChart },
  { href: "/admin/audit", label: "История", icon: IconHistory },
];

export function AdminSidebarNav() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({ review: 0, newLeads: 0, overdue: 0 });
  const [chatUnreadAny, setChatUnreadAny] = useState(false);

  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch("/api/admin/badges");
        if (res.ok) setBadges(await res.json() as Badges);
      } catch {
        // ignore network errors silently
      }
    }
    void fetchBadges();
    const id = setInterval(() => void fetchBadges(), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function fetchChatUnread() {
      try {
        const res = await fetch("/api/orders/unread", { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { global?: { hasAnyUnreadChats?: boolean } };
          setChatUnreadAny(Boolean(d.global?.hasAnyUnreadChats));
        }
      } catch {
        // ignore
      }
    }
    void fetchChatUnread();
    const id = setInterval(() => void fetchChatUnread(), 30_000);
    function onChatUnreadEvent() {
      void fetchChatUnread();
    }
    window.addEventListener("vd:order-unread-changed", onChatUnreadEvent);
    return () => {
      clearInterval(id);
      window.removeEventListener("vd:order-unread-changed", onChatUnreadEvent);
    };
  }, [pathname]);

  function active(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-2">
      {items.map((item) => {
        const isOn = active(item.href);
        const count = item.badgeKey ? badges[item.badgeKey] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2.5 text-base font-medium transition-colors md:min-h-0 md:py-2 md:text-sm",
              isOn
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            <item.icon
              className={cn("h-[18px] w-[18px] shrink-0", isOn ? "text-white" : "text-zinc-500")}
            />
            <span className="flex-1">{item.label}</span>
            {item.href === "/admin/orders" && chatUnreadAny && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                title="Есть непрочитанные сообщения в чатах по заказам"
                aria-hidden
              />
            )}
            {count > 0 && (
              <span
                className={cn(
                  "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none",
                  isOn ? "bg-white text-slate-900" : "bg-red-500 text-white",
                )}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
      <PushNotificationsToggle layout="nav" />
    </nav>
  );
}

function IconLayout({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="11" width="7" height="10" rx="1" />
      <rect x="3" y="15" width="7" height="6" rx="1" />
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

function IconUserCog({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20v-1a6 6 0 0112 0v1" />
      <circle cx="19" cy="19" r="2" />
      <path d="M19 17v2M19 21v2M17.5 19h2M20.5 19h2" />
    </svg>
  );
}

function IconTemplate({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-3 3 3 5-6" />
    </svg>
  );
}

function IconHistory({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4M16 14h-4M12 18v-4" />
    </svg>
  );
}
