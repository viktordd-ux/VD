"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PushNotificationsToggle } from "@/components/push-notifications-toggle";
import { cn } from "@/lib/cn";

const items: {
  href: string;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
}[] = [
  {
    href: "/executor",
    label: "Мои задачи",
    icon: IconList,
  },
  {
    href: "/executor/earnings",
    label: "Заработок",
    icon: IconWallet,
  },
  {
    href: "/executor#password",
    label: "Сменить пароль",
    icon: IconKey,
  },
];

function navItemActive(pathname: string, href: string): boolean {
  if (href === "/executor") {
    return (
      pathname === "/executor" ||
      (pathname.startsWith("/executor/orders") && !pathname.startsWith("/executor/earnings"))
    );
  }
  if (href === "/executor/earnings") {
    return pathname === "/executor/earnings" || pathname.startsWith("/executor/earnings/");
  }
  return false;
}

export function ExecutorSidebarNav() {
  const pathname = usePathname();
  const [chatUnreadAny, setChatUnreadAny] = useState(false);

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

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-2">
      {items.map((item) => {
        const isOn = navItemActive(pathname, item.href);
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
            {item.href === "/executor" && chatUnreadAny && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-red-500"
                title="Есть непрочитанные сообщения в чатах по заказам"
                aria-hidden
              />
            )}
          </Link>
        );
      })}
      <PushNotificationsToggle layout="nav" />
    </nav>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M16 12h4" />
      <circle cx="16" cy="12" r="1" />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

function IconKey({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="15" r="4" />
      <path d="M10.5 13.5L21 3M15 3h6v6" />
    </svg>
  );
}
