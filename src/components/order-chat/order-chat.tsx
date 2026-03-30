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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/toast-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { MessageDto } from "@/lib/message-serialize";
import { mergeMessages, removeMessageById } from "@/lib/chat-message-merge";
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
              : "font-medium text-blue-700 underline decoration-blue-300"
          }
        >
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const ChatMessageRow = memo(function ChatMessageRow({
  m,
  mine,
  timeLabel,
}: {
  m: MessageDto;
  mine: boolean;
  timeLabel: string;
}) {
  return (
    <div
      className={`vd-message-enter flex ${mine ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[min(85%,28rem)] rounded-[1.15rem] px-3.5 py-2.5 text-[15px] leading-[1.45] shadow-sm shadow-zinc-950/[0.04] ${
          mine
            ? "rounded-br-md bg-zinc-900 text-white"
            : "rounded-bl-md bg-white text-zinc-900 ring-1 ring-zinc-200/80"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">
          {messageWithMentions(m.text, mine)}
        </p>
        <p
          className={`mt-1.5 text-[11px] tabular-nums tracking-wide ${
            mine ? "text-zinc-400" : "text-zinc-500"
          }`}
        >
          {timeLabel}
          {!mine && (
            <span className="ml-1.5 opacity-75">
              · {m.role === "admin" ? "студия" : "исполнитель"}
            </span>
          )}
        </p>
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
};

export function OrderChat({
  orderId,
  supabaseUrl,
  supabaseAnonKey,
  variant = "default",
  initialHasUnreadChat = false,
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

  /** Только непрочитанные сообщения (не «проект») — красная точка на чате. */
  const [showChatUnread, setShowChatUnread] = useState(!!initialHasUnreadChat);

  const [peerTyping, setPeerTyping] = useState(false);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]
  > | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundSeenMsgIdRef = useRef<string | null>(null);

  const currentUserId = session?.user?.id;
  sessionUserIdRef.current = currentUserId;

  type SendCtx = {
    previous: MessageDto[] | undefined;
    optimisticId: string;
    msgKey: ReturnType<typeof queryKeys.orderMessages>;
    previousInput: string;
  };

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId, text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw { status: res.status, body };
      }
      return res.json() as Promise<{ message?: unknown }>;
    },
    onMutate: async (text) => {
      const role = session?.user?.role as MessageDto["role"];
      const msgKey = queryKeys.orderMessages(orderId);
      await queryClient.cancelQueries({ queryKey: msgKey });
      const previous = queryClient.getQueryData<MessageDto[]>(msgKey);
      const previousInput = input;
      const optimisticId = `pending:${crypto.randomUUID()}`;
      const optimistic: MessageDto = {
        id: optimisticId,
        orderId,
        senderId: currentUserId!,
        role,
        text,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<MessageDto[]>(msgKey, (prev) =>
        mergeMessages(prev ?? [], optimistic),
      );
      setInput("");
      return {
        previous,
        optimisticId,
        msgKey,
        previousInput,
      } satisfies SendCtx;
    },
    onError: (err, _text, ctx) => {
      if (ctx?.msgKey) {
        queryClient.setQueryData(ctx.msgKey, ctx.previous);
      }
      if (ctx?.previousInput !== undefined) setInput(ctx.previousInput);
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
    "fixed right-4 z-40 max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6";

  const fetchUnread = useCallback(async () => {
    const res = await fetch(
      `/api/orders/${encodeURIComponent(orderId)}/read-state`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as { hasUnreadChat?: boolean };
    setShowChatUnread(Boolean(data.hasUnreadChat));
  }, [orderId]);

  useEffect(() => {
    setShowChatUnread(!!initialHasUnreadChat);
  }, [orderId, initialHasUnreadChat]);

  useEffect(() => {
    prevLenRef.current = 0;
    nearBottomRef.current = true;
    prevDockOpenRef.current = false;
    soundSeenMsgIdRef.current = null;
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
    if (!supabase || !orderId) return;
    const ch = supabase.channel(`typing:${orderId}`, {
      config: { broadcast: { ack: false } },
    });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      const raw = payload as { payload?: { userId?: string } };
      const p = raw.payload;
      const uid = p?.userId;
      if (!uid || uid === currentUserId) return;
      setPeerTyping(true);
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), 2500);
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") typingChannelRef.current = ch;
    });
    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(ch);
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
    setShowChatUnread(false);
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
          setShowChatUnread(false);
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
              x.id.startsWith("pending:") && x.senderId === uid && x.text === m.text,
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
        setShowChatUnread(true);
        dispatchOrderUnreadChanged();
        return;
      }
      if (variant !== "dock" && !chatSectionVisibleRef.current) {
        setShowChatUnread(true);
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
  }, [orderId, supabase, variant, queryClient]);

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
        setShowChatUnread(false);
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
    sendMutation.mutate(text);
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
            showChatUnread ? "Открыть чат по заказу — есть непрочитанное" : "Открыть чат по заказу"
          }
        >
          <IconChatBubble className="h-7 w-7" />
          {showChatUnread ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-[30px] w-[30px] rounded-full border-2 border-zinc-900 bg-red-500"
              aria-hidden
            />
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
            {showChatUnread ? (
              <span className="inline-block h-6 w-6 rounded-full bg-red-500" aria-hidden />
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

      {chatLoadError && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {chatLoadError}
        </p>
      )}

      <div
        ref={scrollRef}
        style={{ overflowAnchor: "none" } as CSSProperties}
        className={cn(
          "mt-4 flex min-h-[10rem] flex-col gap-3 overflow-y-auto overflow-x-hidden rounded-xl border border-zinc-200/40 bg-zinc-50/40 p-3.5 [scrollbar-gutter:stable]",
          tallMessages ? "min-h-0 flex-1" : "max-h-[min(24rem,50vh)]",
        )}
      >
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
          <p className="text-sm text-zinc-500">Пока нет сообщений. Напишите первым.</p>
        ) : (
          messages.map((m) => {
            const mine = Boolean(currentUserId && m.senderId === currentUserId);
            const timeLabel = formatChatMessageTime(m.createdAt);
            return (
              <ChatMessageRow key={m.id} m={m} mine={mine} timeLabel={timeLabel} />
            );
          })
        )}
      </div>

      {peerTyping ? (
        <p className="mt-2 text-xs text-zinc-500 vd-fade-in">Собеседник печатает…</p>
      ) : null}

      <form onSubmit={onSend} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="sr-only" htmlFor={`order-chat-input-${orderId}`}>
          Сообщение
        </label>
        <textarea
          id={`order-chat-input-${orderId}`}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
            typingDebounceRef.current = setTimeout(() => {
              const ch = typingChannelRef.current;
              if (ch && currentUserId) {
                void ch.send({
                  type: "broadcast",
                  event: "typing",
                  payload: { userId: currentUserId },
                });
              }
            }, 400);
          }}
          placeholder="Введите сообщение…"
          rows={2}
          maxLength={8000}
          className="min-h-[2.75rem] w-full flex-1 resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm leading-relaxed outline-none ring-zinc-400 focus:border-zinc-400 focus:ring-2"
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
