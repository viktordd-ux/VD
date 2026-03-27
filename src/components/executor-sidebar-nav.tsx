"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    href: "/executor#password",
    label: "Сменить пароль",
    icon: IconKey,
  },
];

export function ExecutorSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 p-2">
      {items.map((item) => {
        const isTasks = item.href === "/executor";
        const isOn = isTasks
          ? pathname === "/executor" || pathname.startsWith("/executor/orders")
          : false;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              isOn
                ? "bg-zinc-900 text-white shadow-sm"
                : "text-zinc-700 hover:bg-zinc-100",
            )}
          >
            <item.icon
              className={cn("h-[18px] w-[18px] shrink-0", isOn ? "text-white" : "text-zinc-500")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
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
