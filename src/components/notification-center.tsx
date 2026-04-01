"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { NavBadgePill } from "@/components/nav-badge-pill";
import {
  decrementNavNotificationByOne,
  getNavBadgesQueryOptions,
  setNavNotificationUnreadToZero,
  type NavBadgesPayload,
} from "@/lib/nav-badges-client";
import {
  normalizeNotificationRowsFromApi,
  parseNotificationRealtimeRow,
  type NotificationListRow,
} from "@/lib/notification-realtime-map";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

function dispatchNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vd:notifications-changed"));
}

type Row = NotificationListRow;

async function fetchNotifications(): Promise<{ notifications: Row[] }> {
  const res = await fetch("/api/notifications", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const text = await res.text().catch(() => "");
  let json: { notifications?: unknown } = {};
  try {
    json = text ? (JSON.parse(text) as { notifications?: unknown }) : {};
  } catch {
    throw new Error(
      res.ok ? "notifications:invalid_json" : `notifications:${res.status}`,
    );
  }
  if (!res.ok) {
    throw new Error(
      text ? `notifications:${res.status}:${text.slice(0, 160)}` : `notifications:${res.status}`,
    );
  }
  const raw = json.notifications;
  if (!Array.isArray(raw)) {
    throw new Error("notifications:invalid_payload");
  }
  const notifications = normalizeNotificationRowsFromApi(raw);
  return { notifications };
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

function extractOrderIdFromHref(href: string | null): string | null {
  if (!href) return null;
  const m = /\/(?:admin|executor)\/orders\/([^/?#]+)/.exec(href);
  return m ? m[1] : null;
}

function orderLabelFromNotification(n: Row): string {
  const m = /«([^»]+)»/.exec(n.title);
  if (m?.[1]) return m[1];
  const t = n.title.trim();
  return t.length > 52 ? `${t.slice(0, 49)}…` : t;
}

type NotificationVisualKind = "message" | "status" | "deadline" | "system";

function notificationVisualKind(n: Row): NotificationVisualKind {
  if (n.kind === "chat") return "message";
  if (n.kind === "order") {
    const c = `${n.title} ${n.body}`.toLowerCase();
    if (/дедлайн|deadline|срок|этап|checkpoint|чекпоинт/i.test(c)) {
      return "deadline";
    }
    return "status";
  }
  return "system";
}

function visualKindLabel(k: NotificationVisualKind): string {
  switch (k) {
    case "message":
      return "Сообщение";
    case "status":
      return "Статус";
    case "deadline":
      return "Дедлайн";
    default:
      return "Система";
  }
}

function sortNotificationsByOrderThenTime(items: Row[]): Row[] {
  return [...items].sort((a, b) => {
    const oa = extractOrderIdFromHref(a.linkHref) ?? "";
    const ob = extractOrderIdFromHref(b.linkHref) ?? "";
    if (oa !== ob) return oa.localeCompare(ob);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function groupRowsByOrder(rows: Row[]): {
  key: string;
  label: string | null;
  rows: Row[];
}[] {
  const sorted = sortNotificationsByOrderThenTime(rows);
  const out: { key: string; label: string | null; rows: Row[] }[] = [];
  for (const n of sorted) {
    const oid = extractOrderIdFromHref(n.linkHref);
    const key = oid ?? `single:${n.id}`;
    const last = out[out.length - 1];
    if (last && last.key === key) {
      last.rows.push(n);
    } else {
      out.push({
        key,
        label: oid ? orderLabelFromNotification(n) : null,
        rows: [n],
      });
    }
  }
  return out;
}

type NotificationCenterProps = { triggerClassName?: string };

export function NotificationCenter({ triggerClassName }: NotificationCenterProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const optimisticNotifReadIdsRef = useRef(new Set<string>());
  const bulkNotifReadRef = useRef(false);

  const userId = session?.user?.id;

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: fetchNotifications,
    enabled: !!userId,
    staleTime: STALE_MS.notifications,
    gcTime: 10 * 60_000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const navBadgeOpts = useMemo(
    () => ({
      ...getNavBadgesQueryOptions(queryClient),
      placeholderData: (prev: NavBadgesPayload | undefined) => prev,
    }),
    [queryClient],
  );

  const { data: navBadges } = useQuery({
    ...navBadgeOpts,
    enabled: !!userId,
  });

  const list = data?.notifications ?? [];
  const unread = list.filter((n) => !n.readAt).length;
  const bellCount = Math.max(0, Number(navBadges?.notificationUnreadCount ?? 0));

  const grouped = useMemo(() => groupNotificationsByDay(list), [list]);

  const applyMarkAllReadAfterFetch = useCallback(
    async (payload: { notifications: Row[] } | undefined) => {
      if (!payload?.notifications?.some((n) => !n.readAt)) return;
      bulkNotifReadRef.current = true;
      const now = new Date().toISOString();
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications() });
      queryClient.setQueryData<{ notifications: Row[] }>(queryKeys.notifications(), {
        notifications: payload.notifications.map((n) => ({ ...n, readAt: n.readAt ?? now })),
      });
      await markAllRead();
      setNavNotificationUnreadToZero(queryClient);
      dispatchNotificationsChanged();
      void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
      window.setTimeout(() => {
        bulkNotifReadRef.current = false;
      }, 2500);
    },
    [queryClient],
  );

  const handleBellClick = useCallback(async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    try {
      const result = await refetch();
      if (process.env.NODE_ENV === "development") {
        console.log("notifications loaded", result.data);
      }
      await applyMarkAllReadAfterFetch(result.data);
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("[NotificationCenter] refetch on open failed", e);
      }
    }
  }, [open, refetch, applyMarkAllReadAfterFetch]);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const onInsert = (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) => {
      const row = parseNotificationRealtimeRow(
        payload.new as Record<string, unknown>,
      );
      if (!row) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
        return;
      }
      queryClient.setQueryData<{ notifications: Row[] }>(
        queryKeys.notifications(),
        (old) => {
          if (!old?.notifications) return { notifications: [row] };
          if (old.notifications.some((n) => n.id === row.id)) return old;
          return { notifications: [row, ...old.notifications] };
        },
      );
      queryClient.setQueryData(
        queryKeys.navBadges(),
        (old: NavBadgesPayload | undefined) => {
          if (!old) {
            return {
              unreadChatOrderCount: 0,
              notificationUnreadCount: 1,
              isFallback: false,
            };
          }
          return {
            ...old,
            notificationUnreadCount: old.notificationUnreadCount + 1,
            isFallback: false,
          };
        },
      );
      dispatchNotificationsChanged();
    };

    const onUpdate = (
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) => {
      const oldRow = parseNotificationRealtimeRow(
        payload.old as Record<string, unknown>,
      );
      const row = parseNotificationRealtimeRow(
        payload.new as Record<string, unknown>,
      );
      if (!row) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
        return;
      }
      queryClient.setQueryData<{ notifications: Row[] }>(
        queryKeys.notifications(),
        (old) => {
          if (!old?.notifications) return old;
          return {
            notifications: old.notifications.map((n) =>
              n.id === row.id ? row : n,
            ),
          };
        },
      );
      if (oldRow?.readAt == null && row.readAt != null) {
        if (optimisticNotifReadIdsRef.current.has(row.id)) {
          optimisticNotifReadIdsRef.current.delete(row.id);
        } else if (!bulkNotifReadRef.current) {
          decrementNavNotificationByOne(queryClient);
        }
      }
      dispatchNotificationsChanged();
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
        onInsert,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onUpdate,
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
        optimisticNotifReadIdsRef.current.add(n.id);
        decrementNavNotificationByOne(queryClient);
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
        dispatchNotificationsChanged();
      }
      if (n.linkHref) {
        setOpen(false);
      }
    },
    [queryClient],
  );

  if (!userId) return null;

  const showEmpty = !isLoading && !isError && list.length === 0;
  const showSkeleton = isLoading && list.length === 0;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => void handleBellClick()}
        className={cn(
          "relative flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] shadow-sm transition-all duration-150 ease-out hover:bg-[color:var(--muted-bg)] hover:scale-[1.02] active:scale-[0.98] md:h-9 md:min-w-9",
          triggerClassName,
        )}
        aria-label="Уведомления"
        aria-expanded={open}
      >
        <IconBell className="h-5 w-5" />
        <span className="pointer-events-none absolute -right-0.5 -top-0.5 z-10 flex h-5 min-w-5 items-center justify-center overflow-visible">
          <NavBadgePill count={bellCount} className="h-5 min-w-5 px-1 text-[10px]" />
        </span>
      </button>

      {open && (
        <div className="pointer-events-auto absolute right-0 top-full z-[95] mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-xl shadow-black/10 dark:shadow-black/50 vd-fade-in">
          <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
            <span className="text-sm font-semibold text-[var(--text)]">Уведомления</span>
            {unread > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  bulkNotifReadRef.current = true;
                  await markAllRead();
                  queryClient.setQueryData<{ notifications: Row[] }>(queryKeys.notifications(), {
                    notifications: list.map((x) => ({
                      ...x,
                      readAt: x.readAt ?? new Date().toISOString(),
                    })),
                  });
                  setNavNotificationUnreadToZero(queryClient);
                  dispatchNotificationsChanged();
                  void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
                  window.setTimeout(() => {
                    bulkNotifReadRef.current = false;
                  }, 2500);
                }}
                className="text-xs font-medium text-[var(--muted)] transition-colors hover:text-[var(--text)]"
              >
                Прочитать всё
              </button>
            ) : null}
          </div>
          <div className="max-h-[min(60vh,24rem)] overflow-y-auto overscroll-contain">
            {showSkeleton || (isFetching && list.length === 0) ? (
              <div className="space-y-3 px-4 py-5">
                <Skeleton className="h-4 w-40 rounded-md" />
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : isError ? (
              <div className="space-y-3 px-4 py-8 text-center">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Не удалось загрузить уведомления
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {error instanceof Error ? error.message : "Ошибка сети"}
                </p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="rounded-lg border border-[color:var(--border)] bg-[var(--muted-bg)] px-3 py-1.5 text-sm font-medium text-[var(--text)] transition hover:bg-[color:var(--border)]"
                >
                  Повторить
                </button>
              </div>
            ) : showEmpty ? (
              <div className="flex flex-col items-center px-4 py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--muted-bg)] text-[var(--muted)]">
                  <IconBellLarge className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-[var(--text)]">Пока нет уведомлений</p>
                <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[var(--muted)]">
                  События по заказам и чату появятся здесь. Список обновляется с сервера при каждом открытии.
                </p>
              </div>
            ) : (
              <ul className="pb-2">
                {grouped.map(([day, items]) => (
                  <li key={day} className="pt-2">
                    <p className="sticky top-0 z-10 bg-[var(--card)] px-4 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {formatNotificationDayLabel(day)}
                    </p>
                    <div className="space-y-2 px-2">
                      {groupRowsByOrder(items).map((sec) => (
                        <div key={sec.key}>
                          {sec.label ? (
                            <p className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                              {sec.label}
                            </p>
                          ) : null}
                          <ul className="space-y-0.5">
                            {sec.rows.map((n) => (
                              <li key={n.id}>
                                {n.linkHref ? (
                                  <Link
                                    href={n.linkHref}
                                    onClick={() => void onOpenItem(n)}
                                    className={cn(
                                      "block rounded-lg px-2 py-1.5 transition-all duration-200 ease-out hover:bg-[color:var(--muted-bg)] active:scale-[0.99]",
                                      !n.readAt && "bg-blue-500/10 dark:bg-blue-500/15",
                                    )}
                                  >
                                    <NotificationRow n={n} />
                                  </Link>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void onOpenItem(n)}
                                    className={cn(
                                      "w-full rounded-lg px-2 py-1.5 text-left transition-all duration-200 ease-out hover:bg-[color:var(--muted-bg)] active:scale-[0.99]",
                                      !n.readAt && "bg-blue-500/10 dark:bg-blue-500/15",
                                    )}
                                  >
                                    <NotificationRow n={n} />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
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

function NotificationKindIcon({ kind }: { kind: NotificationVisualKind }) {
  const cls = "h-4 w-4";
  switch (kind) {
    case "message":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "status":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
    case "deadline":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    default:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" />
        </svg>
      );
  }
}

function NotificationRow({ n }: { n: NotificationListRow }) {
  const time = (() => {
    const d = new Date(n.createdAt);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  })();
  const vk = notificationVisualKind(n);

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--muted-bg)] text-[var(--text)] transition-colors duration-150">
        <NotificationKindIcon kind={vk} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {visualKindLabel(vk)}
          </span>
          {time ? (
            <span className="shrink-0 text-[10px] tabular-nums text-[var(--muted)]">{time}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-[var(--text)]">{n.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[var(--muted)]">{n.body}</p>
      </div>
    </div>
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

function IconBellLarge({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
