"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryKeys } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";

function dispatchNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vd:notifications-changed"));
}

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

function groupNotificationsByDay(rows: Row[]): [string, Row[]][] {
  const map = new Map<string, Row[]>();
  for (const n of rows) {
    const day = n.createdAt.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(n);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function formatNotificationDayLabel(dayYmd: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  if (dayYmd === today) return "Сегодня";
  if (dayYmd === yesterday) return "Вчера";
  const [yy, mm, dd] = dayYmd.split("-").map(Number);
  if (!yy || !mm || !dd) return dayYmd;
  return new Date(yy, mm - 1, dd).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: yy !== new Date().getFullYear() ? "numeric" : undefined,
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

  const grouped = useMemo(() => groupNotificationsByDay(list), [list]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    };
    const onNotificationInsert = () => {
      queryClient.setQueryData(
        queryKeys.navBadges(),
        (old: { global?: { unreadChatOrderCount?: number; notificationUnreadCount?: number } } | undefined) => {
          const g = old?.global ?? {};
          return {
            global: {
              ...g,
              notificationUnreadCount: Math.max(
                0,
                Number(g.notificationUnreadCount ?? 0) + 1,
              ),
            },
          };
        },
      );
      dispatchNotificationsChanged();
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    };
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
        onNotificationInsert,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        invalidate,
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
        queryClient.setQueryData<{ notifications: Row[] }>(
          queryKeys.notifications(),
          (old) =>
            old
              ? {
                  notifications: old.notifications.map((x) =>
                    x.id === n.id
                      ? { ...x, readAt: new Date().toISOString() }
                      : x,
                  ),
                }
              : old,
        );
        await markRead([n.id]);
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
        dispatchNotificationsChanged();
      }
      if (n.linkHref) {
        setOpen(false);
      }
    },
    [queryClient],
  );

  const markAllReadOnOpen = useCallback(async () => {
    const key = queryKeys.notifications();
    const snap = queryClient.getQueryData<{ notifications: Row[] }>(key);
    if (!snap?.notifications?.some((n) => !n.readAt)) return;
    const now = new Date().toISOString();
    await queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<{ notifications: Row[] }>(key, {
      notifications: snap.notifications.map((n) => ({ ...n, readAt: n.readAt ?? now })),
    });
    await markAllRead();
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
    dispatchNotificationsChanged();
  }, [queryClient]);

  if (!userId) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) void markAllReadOnOpen();
            return next;
          });
        }}
        className="relative flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] shadow-sm transition-all duration-200 ease-out hover:bg-[color:var(--muted-bg)] hover:scale-[1.02] active:scale-[0.98] md:h-9 md:min-w-9"
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
        <div className="pointer-events-auto absolute right-0 top-full z-[90] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-xl shadow-black/10 dark:shadow-black/50">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--text)]">Уведомления</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  await markAllRead();
                  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
                  void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
                  dispatchNotificationsChanged();
                }}
                className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                Прочитать всё
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto overscroll-contain">
            {isPending ? (
              <div className="space-y-3 px-4 py-5">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : list.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">Пока пусто</p>
            ) : (
              <ul className="pb-2">
                {grouped.map(([day, items]) => (
                  <li key={day} className="pt-2">
                    <p className="sticky top-0 z-10 bg-[var(--card)] px-4 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {formatNotificationDayLabel(day)}
                    </p>
                    <ul className="space-y-0.5 px-2">
                      {items.map((n) => (
                        <li key={n.id}>
                          {n.linkHref ? (
                            <Link
                              href={n.linkHref}
                              onClick={() => void onOpenItem(n)}
                              className={cn(
                                "block rounded-lg px-3 py-2.5 transition-colors hover:bg-[color:var(--muted-bg)]",
                                !n.readAt && "bg-blue-500/10 dark:bg-blue-500/15",
                              )}
                            >
                              <NotificationBody n={n} />
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void onOpenItem(n)}
                              className={cn(
                                "w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--muted-bg)]",
                                !n.readAt && "bg-blue-500/10 dark:bg-blue-500/15",
                              )}
                            >
                              <NotificationBody n={n} />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
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
  const time = (() => {
    const d = new Date(n.createdAt);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  })();

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          {n.kind}
        </span>
        {time ? (
          <span className="shrink-0 text-[10px] tabular-nums text-[var(--muted)]">{time}</span>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text)]">{n.title}</p>
      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">{n.body}</p>
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
