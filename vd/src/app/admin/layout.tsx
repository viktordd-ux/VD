import Link from "next/link";
import { AdminSilenceAlerts } from "@/components/admin-silence-alerts";
import { SignOutButton } from "@/components/sign-out-button";

const nav = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/leads", label: "Лиды" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/templates", label: "Шаблоны" },
  { href: "/admin/quick", label: "One Click" },
  { href: "/admin/users", label: "Исполнители" },
  { href: "/admin/finance", label: "Финансы" },
  { href: "/admin/risks", label: "Риски" },
  { href: "/admin/audit", label: "Аудит" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">
            V<span className="text-zinc-400">|</span>D
          </span>
          <p className="text-xs text-zinc-500">Админ</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-100 p-3">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <AdminSilenceAlerts />
        {children}
      </main>
    </div>
  );
}
