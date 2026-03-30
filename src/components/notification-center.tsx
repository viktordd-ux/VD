"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { queryKeys } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  readAt: string | null;
  createdAt: string;
};

async function fetchNotifications(): Promise<{ notifications: Row[] }> {
  const res = await fetch("/api/notifications");
  if (!res.ok) throw new Error("notifications");
  return res.json() as Promise<{ notifications: Row[] }>;
}

async function markRead(ids: string[]) {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

async function markAllRead() {
  await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ readAll: true }),
  });
}

export function NotificationCenter() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const userId = session?.user?.id;

  const { data, isPending } = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: fetchNotifications,
    enabled: !!userId,
    staleTime: 15_000,
  });

  const list = data?.notifications ?? [];
  const unread = list.filter((n) => !n.readAt).length;

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel(`notifications-user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const onOpenItem = useCallback(
    async (n: Row) => {
      if (!n.readAt) {
        await markRead([n.id]);
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      }
      if (n.linkHref) {
        setOpen(false);
      }
    },
    [queryClient],
  );

  if (!userId) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-zinc-200/80 bg-white text-zinc-700 shadow-sm transition-all duration-150 ease-out hover:bg-zinc-50 hover:scale-[1.02] active:scale-[0.98] md:h-9 md:min-w-9"
        aria-label="Уведомления"
      >
        <IconBell className="h-5 w-5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="pointer-events-auto absolute right-0 top-full z-[90] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
            <span className="text-sm font-semibold text-zinc-900">Уведомления</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  await markAllRead();
                  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
                }}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
              >
                Прочитать всё
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto">
            {isPending ? (
              <p className="px-3 py-6 text-center text-sm text-zinc-500">Загрузка…</p>
            ) : list.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-zinc-500">Пока пусто</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {list.map((n) => (
                  <li key={n.id}>
                    {n.linkHref ? (
                      <Link
                        href={n.linkHref}
                        onClick={() => void onOpenItem(n)}
                        className={cn(
                          "block px-3 py-2.5 transition-colors hover:bg-zinc-50",
                          !n.readAt && "bg-blue-50/40",
                        )}
                      >
                        <NotificationBody n={n} />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void onOpenItem(n)}
                        className={cn(
                          "w-full px-3 py-2.5 text-left transition-colors hover:bg-zinc-50",
                          !n.readAt && "bg-blue-50/40",
                        )}
                      >
                        <NotificationBody n={n} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationBody({ n }: { n: Row }) {
  return (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{n.kind}</p>
      <p className="mt-0.5 text-sm font-medium text-zinc-900">{n.title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{n.body}</p>
    </>
  );
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
