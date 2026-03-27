import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

export default function ExecutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="flex w-52 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">
            V<span className="text-zinc-400">|</span>D
          </span>
          <p className="text-xs text-zinc-500">Исполнитель</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          <Link
            href="/executor"
            className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Мои задачи
          </Link>
          <Link
            href="/executor#password"
            className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Сменить пароль
          </Link>
        </nav>
        <div className="border-t border-zinc-100 p-3">
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
