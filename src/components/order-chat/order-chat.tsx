"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSession } from "next-auth/react";
import type { CSSProperties, ReactNode } from "react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/toast-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { MessageDto } from "@/lib/message-serialize";
import { mergeMessages, removeMessageById } from "@/lib/chat-message-merge";
import { buildChatTimeline } from "@/lib/chat-day-divider";
import { formatChatMessageTime } from "@/lib/chat-display-time";
import {
  normalizeCreatedAt,
  normalizeMessageDto,
} from "@/lib/message-normalize";
import { useOrderMessagesQuery } from "@/hooks/use-order-messages-query";
import { queryKeys } from "@/lib/query-keys";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[OrderChat]", ...args);
  }
};

function playSoftPing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.04;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.06);
    o.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}

/** Списки заказов и сайдбар подтягивают флаги с сервера. */
function dispatchOrderUnreadChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("vd:order-unread-changed"));
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

function messageWithMentions(text: string, mine: boolean) {
  const parts = text.split(/(@[\w\u0400-\u04FF]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={i}
          className={
            mine
              ? "font-medium text-blue-200 underline decoration-blue-300/80"
              : "font-medium text-blue-600 underline decoration-blue-400/70 dark:text-blue-400 dark:decoration-blue-500/50"
          }
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function roleShortLabel(role: MessageDto["role"]) {
  return role === "admin" ? "студия" : "исполнитель";
}

function getReplyPreview(target: MessageDto | undefined): string | null {
  if (!target) return null;
  const line = target.text.trim().split(/\n/)[0] ?? "";
  if (!line) return null;
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

function groupMessagesBySender(
  messages: MessageDto[],
  myId: string | undefined,
): {
  senderId: string;
  mine: boolean;
  role: MessageDto["role"];
  items: MessageDto[];
}[] {
  const groups: {
    senderId: string;
    mine: boolean;
    role: MessageDto["role"];
    items: MessageDto[];
  }[] = [];
  for (const m of messages) {
    const mine = Boolean(myId && m.senderId === myId);
    const last = groups[groups.length - 1];
    if (last && last.senderId === m.senderId) {
      last.items.push(m);
    } else {
      groups.push({ senderId: m.senderId, mine, role: m.role, items: [m] });
    }
  }
  return groups;
}

const ChatBubble = memo(function ChatBubble({
  m,
  mine,
  replyPreview,
  onReply,
  onCopy,
}: {
  m: MessageDto;
  mine: boolean;
  replyPreview: string | null;
  onReply: () => void;
  onCopy: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative flex w-full",
        mine ? "justify-end" : "justify-start",
      )}
    >
      <div className="relative max-w-[min(85%,28rem)]">
        <div
          className={cn(
            "mb-1 flex min-h-[28px] items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100",
            mine ? "justify-end" : "justify-start",
          )}
        >
          <button
            type="button"
            onClick={onReply}
            className="min-h-[44px] min-w-[44px] rounded-lg px-2 text-[12px] font-medium text-[var(--muted)] transition hover:bg-[color:var(--muted-bg)] hover:text-[var(--text)] sm:min-h-0 sm:min-w-0"
          >
            Ответить
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="min-h-[44px] min-w-[44px] rounded-lg px-2 text-[12px] font-medium text-[var(--muted)] transition hover:bg-[color:var(--muted-bg)] hover:text-[var(--text)] sm:min-h-0 sm:min-w-0"
          >
            Копировать
          </button>
        </div>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-[15px] leading-[1.45] shadow-sm transition-shadow duration-150 hover:shadow-md",
            mine
              ? "bg-zinc-900 text-white shadow-black/15 dark:bg-zinc-100 dark:text-zinc-900"
              : "border border-[color:var(--border)] bg-[var(--card)] text-[var(--text)] shadow-black/[0.06] dark:shadow-black/30",
          )}
        >
          {m.replyToId && replyPreview ? (
            <p
              className={cn(
                "mb-2 border-l-2 pl-2 text-xs leading-snug",
                mine
                  ? "border-white/40 text-blue-100/90"
                  : "border-[color:var(--border)] text-[var(--muted)]",
              )}
            >
              {replyPreview}
            </p>
          ) : m.replyToId ? (
            <p className="mb-2 text-xs text-[var(--muted)]">Сообщение недоступно</p>
          ) : null}
          <p className="whitespace-pre-wrap break-words">
            {messageWithMentions(m.text, mine)}
          </p>
        </div>
      </div>
    </div>
  );
});

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
  /**
   * С сервера: есть непрочитанные входящие сообщения.
   * Без этого бейдж появлялся только после клиентского fetch и терялся при уходе со страницы.
   */
  initialHasUnreadChat?: boolean;
  /**
   * Позиция FAB на мобилке: с отступом под нижнюю навигацию админа или ближе к низу (исполнитель).
   */
  dockFabBottom?: "with-nav" | "default";
};

export function OrderChat({
  orderId,
  supabaseUrl,
  supabaseAnonKey,
  variant = "default",
  initialHasUnreadChat = false,
  dockFabBottom = "with-nav",
}: OrderChatProps) {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const sessionReady = status !== "loading";
  const {
    data: messages = [],
    isPending: loading,
    error: loadError,
  } = useOrderMessagesQuery(orderId, sessionReady);
  const supabase = useMemo(
    () => getSupabaseBrowserClient({ supabaseUrl, supabaseAnonKey }),
    [supabaseUrl, supabaseAnonKey],
  );

  const [input, setInput] = useState("");
  const chatLoadError =
    loadError instanceof Error
      ? loadError.message === "forbidden"
        ? "Нет доступа к чату"
        : loadError.message === "load"
          ? "Не удалось загрузить чат"
          : null
      : null;
  const [realtimeStatus, setRealtimeStatus] = useState<
    "idle" | "subscribed" | "error" | "unconfigured"
  >("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Обновляется только обработчиком scroll — чтобы не скроллить вниз, если пользователь читает историю. */
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const prevDockOpenRef = useRef(false);
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

  /** Входящие непрочитанные сообщения в чате (для FAB). */
  const [unreadChatCount, setUnreadChatCount] = useState(() =>
    initialHasUnreadChat ? 1 : 0,
  );

  const [peerTypingName, setPeerTypingName] = useState<string | null>(null);
  /** Максимальный lastSeen среди других участников (мс, клиентский heartbeat). */
  const [peerLastSeenMs, setPeerLastSeenMs] = useState<number | null>(null);
  const [presenceTick, setPresenceTick] = useState(0);
  const presenceChannelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]
  > | null>(null);
  const typingChannelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]
  > | null>(null);
  const lastTypingBroadcastRef = useRef(0);
  const peerTypingClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const soundSeenMsgIdRef = useRef<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);

  const currentUserId = session?.user?.id;
  sessionUserIdRef.current = currentUserId;

  const peerLabel =
    session?.user?.role === "admin" ? "Исполнитель" : "Студия";

  const chatTimeline = useMemo(() => {
    const groups = groupMessagesBySender(messages, currentUserId);
    return buildChatTimeline(groups);
  }, [messages, currentUserId]);

  const messageById = useMemo(() => {
    const map = new Map<string, MessageDto>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  useEffect(() => {
    const id = window.setInterval(() => setPresenceTick((t) => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const peerPresenceUi = useMemo(() => {
    void presenceTick;
    if (peerLastSeenMs == null) return { kind: "offline" as const };
    const age = Date.now() - peerLastSeenMs;
    if (age < 30_000) return { kind: "online" as const };
    if (age < 5 * 60_000) return { kind: "recent" as const };
    return { kind: "offline" as const };
  }, [peerLastSeenMs, presenceTick]);

  type SendCtx = {
    previous: MessageDto[] | undefined;
    optimisticId: string;
    msgKey: ReturnType<typeof queryKeys.orderMessages>;
    previousInput: string;
    previousReplyTo: MessageDto | null;
  };

  const sendMutation = useMutation({
    mutationFn: async (vars: { text: string; replyToId: string | null }) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          text: vars.text,
          ...(vars.replyToId ? { reply_to_id: vars.replyToId } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw { status: res.status, body };
      }
      return res.json() as Promise<{ message?: unknown }>;
    },
    onMutate: async (vars) => {
      const role = session?.user?.role as MessageDto["role"];
      const msgKey = queryKeys.orderMessages(orderId);
      await queryClient.cancelQueries({ queryKey: msgKey });
      const previous = queryClient.getQueryData<MessageDto[]>(msgKey);
      const previousInput = input;
      const previousReplyTo = replyTo;
      const optimisticId = `pending:${crypto.randomUUID()}`;
      const optimistic: MessageDto = {
        id: optimisticId,
        orderId,
        senderId: currentUserId!,
        role,
        text: vars.text,
        createdAt: new Date(0).toISOString(),
        replyToId: vars.replyToId,
      };
      queryClient.setQueryData<MessageDto[]>(msgKey, (prev) =>
        mergeMessages(prev ?? [], optimistic),
      );
      setInput("");
      setReplyTo(null);
      return {
        previous,
        optimisticId,
        msgKey,
        previousInput,
        previousReplyTo,
      } satisfies SendCtx;
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.msgKey) {
        queryClient.setQueryData(ctx.msgKey, ctx.previous);
      }
      if (ctx?.previousInput !== undefined) setInput(ctx.previousInput);
      if (ctx?.previousReplyTo !== undefined) setReplyTo(ctx.previousReplyTo);
      const e = err as { status?: number; body?: { error?: string } };
      const msg =
        e?.status === 403
          ? "Нельзя писать в этот заказ"
          : e?.body?.error ?? "Не удалось отправить";
      toast.error(msg);
    },
    onSuccess: (data, _text, ctx) => {
      if (!ctx) return;
      const added = normalizeMessageDto(data.message);
      if (added) {
        queryClient.setQueryData<MessageDto[]>(ctx.msgKey, (prev) => {
          const without = removeMessageById(prev ?? [], ctx.optimisticId);
          return mergeMessages(without, added);
        });
      } else {
        queryClient.setQueryData<MessageDto[]>(ctx.msgKey, (prev) =>
          removeMessageById(prev ?? [], ctx.optimisticId),
        );
      }
    },
  });

  const dockFabPos =
    dockFabBottom === "default"
      ? "fixed right-4 z-[55] bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-6"
      : "fixed right-4 z-[55] max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6";

  const fetchUnread = useCallback(async () => {
    const res = await fetch(
      `/api/orders/${encodeURIComponent(orderId)}/read-state`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      hasUnreadChat?: boolean;
      unreadChatCount?: number;
    };
    const n = Math.max(0, Number(data.unreadChatCount ?? 0));
    if (Number.isFinite(n)) {
      setUnreadChatCount(n);
    } else {
      setUnreadChatCount(data.hasUnreadChat ? 1 : 0);
    }
  }, [orderId]);

  useEffect(() => {
    setUnreadChatCount(initialHasUnreadChat ? 1 : 0);
  }, [orderId, initialHasUnreadChat]);

  useEffect(() => {
    prevLenRef.current = 0;
    nearBottomRef.current = true;
    prevDockOpenRef.current = false;
    soundSeenMsgIdRef.current = null;
    setPeerLastSeenMs(null);
    setPeerTypingName(null);
    setReplyTo(null);
  }, [orderId]);

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

  useEffect(() => {
    function onCloseOverlays() {
      if (isDock) setDockOpen(false);
    }
    window.addEventListener("vd:close-overlays", onCloseOverlays);
    return () => window.removeEventListener("vd:close-overlays", onCloseOverlays);
  }, [isDock]);

  useEffect(() => {
    if (!supabase || !orderId || !currentUserId) return;

    const presenceCh = supabase.channel(`order-presence:${orderId}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceCh.on("presence", { event: "sync" }, () => {
      const state = presenceCh.presenceState() as Record<
        string,
        Array<{ userId?: string; lastSeen?: number }>
      >;
      let best = 0;
      for (const [key, metas] of Object.entries(state)) {
        if (key === currentUserId) continue;
        const meta = Array.isArray(metas) ? metas[0] : undefined;
        const ls = typeof meta?.lastSeen === "number" ? meta.lastSeen : 0;
        if (ls > best) best = ls;
      }
      setPeerLastSeenMs(best > 0 ? best : null);
    });

    const typingCh = supabase.channel(`order-typing:${orderId}`);
    typingCh.on(
      "broadcast",
      { event: "typing" },
      ({ payload }) => {
        const p = payload as { userId?: string; name?: string };
        if (!p?.userId || p.userId === currentUserId) return;
        setPeerTypingName(p.name?.trim() || "Собеседник");
        if (peerTypingClearTimerRef.current) {
          clearTimeout(peerTypingClearTimerRef.current);
        }
        peerTypingClearTimerRef.current = setTimeout(() => {
          setPeerTypingName(null);
        }, 3500);
      },
    );

    typingCh.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        typingChannelRef.current = typingCh;
      }
    });

    const trackPresence = () => {
      void presenceCh.track({
        userId: currentUserId,
        lastSeen: Date.now(),
      });
    };

    presenceCh.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        presenceChannelRef.current = presenceCh;
        trackPresence();
      }
    });

    const hb = window.setInterval(trackPresence, 18_000);

    return () => {
      window.clearInterval(hb);
      presenceChannelRef.current = null;
      typingChannelRef.current = null;
      if (peerTypingClearTimerRef.current) {
        clearTimeout(peerTypingClearTimerRef.current);
      }
      void supabase.removeChannel(typingCh);
      void supabase.removeChannel(presenceCh);
    };
  }, [supabase, orderId, currentUserId]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || !currentUserId) return;
    if (last.senderId === currentUserId) return;
    if (soundSeenMsgIdRef.current === null) {
      soundSeenMsgIdRef.current = last.id;
      return;
    }
    if (soundSeenMsgIdRef.current === last.id) return;
    soundSeenMsgIdRef.current = last.id;
    if (document.hidden || !document.hasFocus()) {
      playSoftPing();
    }
  }, [messages, currentUserId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function onScroll() {
      const node = scrollRef.current;
      if (!node) return;
      const threshold = 72;
      nearBottomRef.current =
        node.scrollHeight - node.scrollTop - node.clientHeight < threshold;
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [orderId]);

  /** Открытый dock — переписка просмотрена: точку убираем сразу, затем синхронизация с сервером. */
  useEffect(() => {
    if (!isDock || !dockOpen) return;
    setUnreadChatCount(0);
    void (async () => {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markChat: true }),
      });
      await fetchUnread();
      dispatchOrderUnreadChanged();
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
          setUnreadChatCount(0);
          void (async () => {
            await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ markChat: true }),
            });
            await fetchUnread();
            dispatchOrderUnreadChanged();
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

      const msgKey = queryKeys.orderMessages(orderId);

      if (payload.eventType === "DELETE") {
        const old = payload.old as Record<string, unknown> | null;
        const id = old?.id != null ? String(old.id) : null;
        if (!id) return;
        queryClient.setQueryData<MessageDto[]>(msgKey, (prev) =>
          removeMessageById(prev ?? [], id),
        );
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
      queryClient.setQueryData<MessageDto[]>(msgKey, (prev) => {
        const list = prev ?? [];
        const uid = sessionUserIdRef.current;
        if (uid != null && m.senderId === uid) {
          const pending = list.find(
            (x) =>
              x.id.startsWith("pending:") &&
              x.senderId === uid &&
              x.text === m.text &&
              (x.replyToId ?? null) === (m.replyToId ?? null),
          );
          if (pending) {
            return mergeMessages(removeMessageById(list, pending.id), m);
          }
        }
        return mergeMessages(list, m);
      });
      const uid = sessionUserIdRef.current;
      const fromOther = uid != null && m.senderId !== uid;
      if (!fromOther) return;
      if (variant === "dock" && !dockOpenRef.current) {
        void fetchUnread();
        dispatchOrderUnreadChanged();
        return;
      }
      if (variant !== "dock" && !chatSectionVisibleRef.current) {
        void fetchUnread();
        dispatchOrderUnreadChanged();
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
  }, [orderId, supabase, variant, queryClient, fetchUnread]);

  const lastMessageKey =
    messages.length > 0 ? messages[messages.length - 1]!.id : "";

  /** Скролл вниз только если пользователь у низа, своё сообщение, первая загрузка или только что открыли dock. */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (loading) return;

    const dockJustOpened = isDock && dockOpen && !prevDockOpenRef.current;
    prevDockOpenRef.current = dockOpen;

    const last = messages[messages.length - 1];
    const prevLen = prevLenRef.current;
    prevLenRef.current = messages.length;
    const initialFill = prevLen === 0 && messages.length > 0;

    const fromSelf = Boolean(
      last && currentUserId && last.senderId === currentUserId,
    );
    const shouldStick = nearBottomRef.current;

    if (initialFill || fromSelf || shouldStick || dockJustOpened) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: initialFill ? "auto" : "smooth",
      });
      nearBottomRef.current = true;
    }
  }, [lastMessageKey, loading, currentUserId, dockOpen, isDock, messages]);

  /** Пока чат открыт/виден — любое новое входящее сообщение сразу считаем прочитанным. */
  const lastIncoming = useMemo(() => {
    if (!currentUserId || messages.length === 0) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.senderId !== currentUserId) return m;
    }
    return null;
  }, [messages, currentUserId]);

  useEffect(() => {
    if (!lastIncoming) return;
    const viewing =
      (isDock && dockOpen) || (!isDock && chatSectionVisibleRef.current);
    if (!viewing) return;
    const t = window.setTimeout(() => {
      void (async () => {
        await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markChat: true }),
        });
        await fetchUnread();
        setUnreadChatCount(0);
        dispatchOrderUnreadChanged();
      })();
    }, 120);
    return () => window.clearTimeout(t);
  }, [lastIncoming?.id, isDock, dockOpen, orderId, fetchUnread]);

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sendMutation.isPending || !currentUserId) return;
    const role = session?.user?.role;
    if (role !== "admin" && role !== "executor") {
      toast.error("Нет прав на отправку");
      return;
    }
    sendMutation.mutate({
      text,
      replyToId: replyTo?.id ?? null,
    });
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
      <div className={dockFabPos}>
        <button
          type="button"
          onClick={() => setDockOpen(true)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg shadow-zinc-950/25 ring-2 ring-white/10 transition hover:bg-zinc-800 focus-visible:outline focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          aria-label={
            unreadChatCount > 0
              ? `Открыть чат — непрочитанных: ${unreadChatCount}`
              : "Открыть чат по заказу"
          }
        >
          <IconChatBubble className="h-7 w-7" />
          {unreadChatCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-2 border-zinc-900 bg-red-500 px-1 text-[11px] font-bold leading-none text-white"
              aria-hidden
            >
              {unreadChatCount > 99 ? "99+" : unreadChatCount}
            </span>
          ) : null}
        </button>
      </div>
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Чат
          </h2>
          <button
            type="button"
            onClick={() => setDockOpen(false)}
            className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition hover:bg-[color:var(--muted-bg)] hover:text-[var(--text)]"
            aria-label="Свернуть чат"
          >
            <IconChevronDown className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <>
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Чат
            {unreadChatCount > 0 ? (
              <span
                className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white"
                aria-hidden
              >
                {unreadChatCount > 99 ? "99+" : unreadChatCount}
              </span>
            ) : null}
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">
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

      {chatLoadError && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {chatLoadError}
        </p>
      )}

      <div
        ref={scrollRef}
        style={{ overflowAnchor: "none" } as CSSProperties}
        className={cn(
          "mt-4 flex min-h-[10rem] flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--muted-bg)]/50 p-3.5 [scrollbar-gutter:stable] dark:bg-white/[0.03]",
          tallMessages ? "min-h-0 flex-1" : "max-h-[min(24rem,50vh)]",
        )}
      >
        {!loading && messages.length > 0 ? (
          <div className="sticky top-0 z-10 -mx-3.5 mb-1 border-b border-[color:var(--border)] bg-[var(--card)]/95 px-3.5 pb-2.5 pt-1 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Собеседник
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-[var(--text)]">
                  {peerLabel}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-[var(--muted)]">
                {!supabase || !currentUserId ? (
                  "—"
                ) : peerPresenceUi.kind === "online" ? (
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    в сети
                  </span>
                ) : peerPresenceUi.kind === "recent" ? (
                  <span className="text-[var(--muted)]">был недавно</span>
                ) : (
                  "не в сети"
                )}
              </span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex flex-col gap-3 py-1" aria-hidden>
            <div className="flex justify-end">
              <Skeleton className="h-11 w-[72%] max-w-sm rounded-2xl rounded-br-md" />
            </div>
            <div className="flex justify-start">
              <Skeleton className="h-14 w-[78%] max-w-md rounded-2xl rounded-bl-md" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-9 w-[55%] max-w-xs rounded-2xl rounded-br-md" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Пока нет сообщений. Напишите первым.</p>
        ) : (
          chatTimeline.map((item, ti) => {
            if (item.kind === "day") {
              return (
                <div
                  key={`day-${item.dayKey}-${ti}`}
                  className="flex items-center gap-3 py-2 vd-fade-in"
                >
                  <div className="h-px flex-1 bg-[color:var(--border)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {item.label}
                  </span>
                  <div className="h-px flex-1 bg-[color:var(--border)]" />
                </div>
              );
            }
            const g = item.group;
            const last = g.items[g.items.length - 1]!;
            const timeLabel = formatChatMessageTime(last.createdAt);
            const peerName =
              g.role === "admin" ? "Студия" : "Исполнитель";
            return (
              <div
                key={`${g.senderId}-${ti}-${last.id}`}
                className={cn(
                  "vd-message-enter flex gap-2.5",
                  g.mine ? "flex-row-reverse" : "flex-row",
                )}
              >
                <div className="flex shrink-0 flex-col pt-0.5">
                  <Avatar
                    size="md"
                    name={g.mine ? session?.user?.name : peerName}
                    seed={g.mine ? currentUserId ?? "me" : g.senderId}
                    ringClassName="ring-2 ring-[var(--card)]"
                  />
                </div>
                <div
                  className={cn(
                    "flex min-w-0 flex-1 flex-col gap-1",
                    g.mine ? "items-end" : "items-stretch",
                  )}
                >
                  {g.items.map((m) => (
                    <ChatBubble
                      key={m.id}
                      m={m}
                      mine={g.mine}
                      replyPreview={getReplyPreview(
                        m.replyToId ? messageById.get(m.replyToId) : undefined,
                      )}
                      onReply={() => setReplyTo(m)}
                      onCopy={() => {
                        void navigator.clipboard.writeText(m.text).then(() => {
                          toast.success("Скопировано");
                        });
                      }}
                    />
                  ))}
                  <p
                    className={cn(
                      "text-[11px] tabular-nums tracking-wide text-[var(--muted)]",
                      g.mine ? "text-right" : "text-left",
                    )}
                  >
                    {timeLabel}
                    {!g.mine && (
                      <span className="ml-1.5 opacity-80">
                        · {roleShortLabel(g.role)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {peerTypingName ? (
        <p className="mt-2 text-xs text-[var(--muted)] vd-fade-in">
          {peerTypingName} печатает…
        </p>
      ) : null}

      <form onSubmit={onSend} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="sr-only" htmlFor={`order-chat-input-${orderId}`}>
          Сообщение
        </label>
        {replyTo ? (
          <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-3 py-2 text-left text-xs text-[var(--muted)]">
            <p className="min-w-0 truncate">
              <span className="font-medium text-[var(--text)]">Ответ: </span>
              {getReplyPreview(replyTo) ?? "…"}
            </p>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="min-h-[44px] shrink-0 rounded-lg px-2 text-[var(--text)] hover:bg-[color:var(--border)] sm:min-h-0"
              aria-label="Отменить ответ"
            >
              ✕
            </button>
          </div>
        ) : null}
        <textarea
          id={`order-chat-input-${orderId}`}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            const ch = typingChannelRef.current;
            if (!ch || !currentUserId) return;
            const now = Date.now();
            if (now - lastTypingBroadcastRef.current < 600) return;
            lastTypingBroadcastRef.current = now;
            void ch.send({
              type: "broadcast",
              event: "typing",
              payload: {
                userId: currentUserId,
                name: session?.user?.name ?? undefined,
              },
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Введите сообщение…"
          rows={2}
          maxLength={8000}
          className="min-h-[3rem] w-full flex-1 resize-y rounded-xl border border-[color:var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-zinc-400 focus:ring-2 focus:ring-zinc-400/30 dark:focus:ring-white/20"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          loading={sendMutation.isPending}
          disabled={sendMutation.isPending || !input.trim() || !currentUserId}
          className="w-full shrink-0 cursor-pointer sm:w-auto"
        >
          Отправить
        </Button>
      </form>
    </Card>
  );

  return dockShell(
    isDock ? chatCard : <div ref={cardRef} className="w-full">{chatCard}</div>,
  );
}
