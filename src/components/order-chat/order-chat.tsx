"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { MessageDto } from "@/lib/message-serialize";
import { formatChatMessageTime } from "@/lib/chat-display-time";
import {
  normalizeCreatedAt,
  normalizeMessageDto,
} from "@/lib/message-normalize";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[OrderChat]", ...args);
  }
};

/** Единый порядок: только normalizeCreatedAt; при равенстве — id. */
function sortMessagesStable(list: MessageDto[]): MessageDto[] {
  return [...list].sort((a, b) => {
    const na = normalizeCreatedAt(a.createdAt) - normalizeCreatedAt(b.createdAt);
    if (na !== 0) return na;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Единый пайплайн: Map по id → дедуп → финальная сортировка по createdAt.
 * Не использует unshift / порядок прихода событий.
 */
function mergeMessages(
  prev: MessageDto[],
  incoming: MessageDto | MessageDto[],
): MessageDto[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  const batch = Array.isArray(incoming) ? incoming : [incoming];
  for (const m of batch) {
    map.set(m.id, m);
  }
  return sortMessagesStable(Array.from(map.values()));
}

function removeMessageById(prev: MessageDto[], id: string): MessageDto[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  map.delete(id);
  return sortMessagesStable(Array.from(map.values()));
}

function IconChatBubble({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export type OrderChatProps = {
  orderId: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Узкая колонка слева: выше область сообщений, скролл только внутри чата */
  variant?: "default" | "sidebar" | "dock";
};

export function OrderChat({
  orderId,
  supabaseUrl,
  supabaseAnonKey,
  variant = "default",
}: OrderChatProps) {
  const { data: session, status } = useSession();
  const supabase = useMemo(
    () => getSupabaseBrowserClient({ supabaseUrl, supabaseAnonKey }),
    [supabaseUrl, supabaseAnonKey],
  );

  /** Инвариант: всегда отсортировано по createdAt (и id при равенстве). */
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "idle" | "subscribed" | "error" | "unconfigured"
  >("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;
  const dockOpenRef = useRef(false);
  const sessionUserIdRef = useRef<string | undefined>(undefined);
  /** Встроенный чат: виден ли блок в viewport (для realtime-бейджа). */
  const chatSectionVisibleRef = useRef(false);

  /** Только для variant=dock: панель по умолчанию свёрнута в FAB */
  const [dockOpen, setDockOpen] = useState(false);
  dockOpenRef.current = dockOpen;

  const [showBadge, setShowBadge] = useState(false);

  const currentUserId = session?.user?.id;
  sessionUserIdRef.current = currentUserId;

  const dockFabPos =
    "fixed right-4 z-40 max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6";

  const fetchUnread = useCallback(async () => {
    const res = await fetch(
      `/api/orders/${encodeURIComponent(orderId)}/read-state`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { showBadge?: boolean };
    setShowBadge(Boolean(data.showBadge));
  }, [orderId]);

  const loadMessages = useCallback(async () => {
    setError(null);
    const res = await fetch(
      `/api/messages?order_id=${encodeURIComponent(orderId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      setError(res.status === 403 ? "Нет доступа к чату" : "Не удалось загрузить чат");
      setMessages([]);
      return;
    }
    const data = (await res.json()) as { messages?: unknown[] };
    const raw = Array.isArray(data.messages) ? data.messages : [];
    const list = raw
      .map((x) => normalizeMessageDto(x))
      .filter((m): m is MessageDto => m != null);
    setMessages(mergeMessages([], list));
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadMessages();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadMessages]);

  useEffect(() => {
    if (status === "loading") return;
    void fetchUnread();
    const id = setInterval(() => void fetchUnread(), 30_000);
    return () => clearInterval(id);
  }, [status, fetchUnread]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "visible") void fetchUnread();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchUnread]);

  const isDock = variant === "dock";
  const isSidebar = variant === "sidebar";

  /** Открытый dock или видимый блок чата — считаем переписку просмотренной. */
  useEffect(() => {
    if (!isDock || !dockOpen) return;
    void (async () => {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markChat: true }),
      });
      await fetchUnread();
    })();
  }, [isDock, dockOpen, orderId, fetchUnread]);

  /** Встроенный чат: отметка при появлении в зоне видимости. */
  useEffect(() => {
    if (isDock) return;
    const el = cardRef.current;
    if (!el) return;
    let prevHit = false;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        const hit = !!e?.isIntersecting && e.intersectionRatio >= 0.22;
        chatSectionVisibleRef.current = hit;
        if (hit && !prevHit) {
          void (async () => {
            await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ markChat: true }),
            });
            await fetchUnread();
          })();
        }
        prevHit = hit;
      },
      { threshold: [0, 0.15, 0.25, 0.5] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isDock, orderId, fetchUnread]);

  useEffect(() => {
    if (!orderId || typeof orderId !== "string") return;

    if (!supabase) {
      devLog("Realtime отключён: нет URL/anon (передайте props с page или NEXT_PUBLIC_* в .env)");
      setRealtimeStatus("unconfigured");
      return;
    }

    setRealtimeStatus("idle");

    const filter = `order_id=eq.${orderId}`;
    devLog("подписка postgres_changes messages *", { orderId, filter });

    function onMessageChange(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      devLog("realtime messages", payload.eventType, payload);

      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const id = old?.id != null ? String(old.id) : null;
        if (!id) return;
        setMessages((prev) => removeMessageById(prev, id));
        return;
      }

      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      // Время только из БД: payload.new.created_at (Realtime postgres_changes)
      const m = normalizeMessageDto(row);
      if (!m || m.orderId !== orderIdRef.current) {
        devLog("строка пропущена", { parsed: m, expectedOrderId: orderIdRef.current });
        return;
      }
      setMessages((prev) => mergeMessages(prev, m));
      const uid = sessionUserIdRef.current;
      const fromOther = uid != null && m.senderId !== uid;
      if (!fromOther) return;
      if (variant === "dock" && !dockOpenRef.current) {
        setShowBadge(true);
        return;
      }
      if (variant !== "dock" && !chatSectionVisibleRef.current) {
        setShowBadge(true);
      }
    }

    const channel = supabase
      .channel(`order-messages:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter,
        },
        onMessageChange,
      )
      .subscribe((status, err) => {
        devLog("subscribe status", status, err ?? "");
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("subscribed");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeStatus("error");
          devLog("ошибка канала", status, err);
        }
      });

    return () => {
      devLog("removeChannel", `order-messages:${orderId}`);
      void supabase.removeChannel(channel);
    };
  }, [orderId, supabase, variant]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending || !currentUserId) return;
    setSending(true);
    setError(null);
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, text }),
    });
    setSending(false);
    if (!res.ok) {
      if (res.status === 403) {
        setError("Нельзя писать в этот заказ");
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setError(err.error ?? "Не удалось отправить");
      }
      return;
    }
    const data = (await res.json()) as { message?: unknown };
    const added = normalizeMessageDto(data.message);
    if (added) {
      setMessages((prev) => mergeMessages(prev, added));
    }
    setInput("");
  }

  const tallMessages = isSidebar || isDock;

  function dockShell(node: ReactNode) {
    if (!isDock) return node;
    return (
      <div
        className={cn(
          dockFabPos,
          "flex w-[min(22rem,calc(100vw-2rem))] flex-col",
          "h-[min(38rem,55dvh)] max-h-[min(38rem,55dvh)]",
        )}
      >
        {node}
      </div>
    );
  }

  function dockFabButton() {
    return (
      <button
        type="button"
        onClick={() => setDockOpen(true)}
        className={cn(
          dockFabPos,
          "relative flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg shadow-zinc-950/25 ring-2 ring-white/10 transition hover:bg-zinc-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
        )}
        aria-label={
          showBadge ? "Открыть чат по заказу — есть непрочитанное" : "Открыть чат по заказу"
        }
      >
        <IconChatBubble className="h-7 w-7" />
        {showBadge ? (
          <span
            className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-red-500"
            aria-hidden
          />
        ) : null}
      </button>
    );
  }

  if (status === "loading") {
    if (isDock && !dockOpen) {
      return dockFabButton();
    }
    const loadingCard = (
      <Card
        className={cn(
          "p-4 md:p-6",
          isSidebar && "flex min-h-[12rem] flex-col lg:max-h-[calc(100dvh-2rem)]",
          isDock &&
            "flex min-h-0 flex-1 flex-col overflow-hidden shadow-2xl ring-1 ring-zinc-200/80",
        )}
      >
        {isDock && (
          <div className="-mt-1 mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => setDockOpen(false)}
              className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Свернуть чат"
            >
              <IconChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}
        <p className="text-sm text-zinc-500">Загрузка чата…</p>
      </Card>
    );
    return dockShell(
      isDock ? loadingCard : <div ref={cardRef} className="w-full">{loadingCard}</div>,
    );
  }

  if (isDock && !dockOpen) {
    return dockFabButton();
  }

  const chatCard = (
    <Card
      className={cn(
        "flex flex-col p-4 md:p-6",
        isSidebar &&
          "min-h-[18rem] max-h-[min(32rem,70vh)] lg:min-h-0 lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden",
        isDock &&
          "min-h-0 flex-1 flex-col overflow-hidden shadow-2xl ring-1 ring-zinc-200/80",
      )}
    >
      {isDock ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Чат
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Переписка по заказу между студией и исполнителем.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDockOpen(false)}
            className="shrink-0 rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Свернуть чат"
          >
            <IconChevronDown className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Чат
            {showBadge ? (
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Переписка по заказу между студией и исполнителем.
          </p>
        </>
      )}

      {realtimeStatus === "unconfigured" && (
        <p className="mt-2 text-xs text-amber-800">
          Мгновенные обновления выключены: в Vercel задайте{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          (как в Supabase → Settings → API) и сделайте <strong>Redeploy</strong>.
        </p>
      )}
      {realtimeStatus === "error" && (
        <p className="mt-2 text-xs text-amber-800">
          Не удалось подключить Realtime. В Supabase:{" "}
          <strong>Database → Publications</strong> или <strong>Replication</strong> — включите
          таблицу <code className="rounded bg-amber-100 px-1">messages</code> для Realtime.
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div
        ref={scrollRef}
        className={cn(
          "mt-4 flex min-h-[10rem] flex-col gap-2 overflow-y-auto overflow-x-hidden rounded-lg border border-zinc-100 bg-zinc-50/80 p-3",
          tallMessages ? "min-h-0 flex-1" : "max-h-[min(24rem,50vh)]",
        )}
      >
        {loading ? (
          <p className="text-sm text-zinc-500">Загрузка сообщений…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500">Пока нет сообщений. Напишите первым.</p>
        ) : (
          messages.map((m) => {
            const mine = currentUserId && m.senderId === currentUserId;
            const timeLabel = formatChatMessageTime(m.createdAt);
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mine
                      ? "rounded-br-md bg-zinc-900 text-white"
                      : "rounded-bl-md bg-white text-zinc-900 ring-1 ring-zinc-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {m.text}
                  </p>
                  <p
                    className={`mt-1 text-[10px] tabular-nums ${
                      mine ? "text-zinc-400" : "text-zinc-500"
                    }`}
                  >
                    {timeLabel}
                    {!mine && (
                      <span className="ml-1 opacity-80">
                        · {m.role === "admin" ? "студия" : "исполнитель"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={onSend} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="sr-only" htmlFor={`order-chat-input-${orderId}`}>
          Сообщение
        </label>
        <textarea
          id={`order-chat-input-${orderId}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Введите сообщение…"
          rows={2}
          maxLength={8000}
          className="min-h-[2.75rem] w-full flex-1 resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm leading-relaxed outline-none ring-zinc-400 focus:border-zinc-400 focus:ring-2"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={sending || !input.trim() || !currentUserId}
          className="w-full shrink-0 sm:w-auto"
        >
          {sending ? "…" : "Отправить"}
        </Button>
      </form>
    </Card>
  );

  return dockShell(
    isDock ? chatCard : <div ref={cardRef} className="w-full">{chatCard}</div>,
  );
}
