"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const links = [
  { href: "/admin", label: "Главная", icon: IconHome },
  { href: "/admin/orders", label: "Заказы", icon: IconOrders },
  { href: "/admin/leads", label: "Лиды", icon: IconUsers },
  { href: "/admin/quick", label: "Создать", icon: IconZap },
] as const;

export function AdminMobileBottomNav() {
  const pathname = usePathname();

  function active(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-zinc-200/80 bg-white/95 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2 backdrop-blur-md md:hidden"
      aria-label="Нижнее меню"
    >
      {links.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          className={cn(
            "flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-all duration-150 ease-out active:scale-[0.97]",
            active(item.href) ? "text-zinc-900" : "text-zinc-500",
          )}
        >
          <item.icon
            className={cn("h-6 w-6", active(item.href) ? "text-zinc-900" : "text-zinc-400")}
          />
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
