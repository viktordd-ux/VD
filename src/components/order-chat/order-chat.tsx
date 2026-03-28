"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MessageDto } from "@/lib/message-serialize";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[OrderChat]", ...args);
  }
};

function pickRow(row: Record<string, unknown>, snake: string, camel: string) {
  const a = row[snake];
  const b = row[camel];
  if (a !== undefined && a !== null) return a;
  if (b !== undefined && b !== null) return b;
  return undefined;
}

function parseMessageFromRealtime(
  row: Record<string, unknown>,
): MessageDto | null {
  const id = pickRow(row, "id", "id");
  const orderId = pickRow(row, "order_id", "orderId");
  const senderId = pickRow(row, "sender_id", "senderId");
  const role = pickRow(row, "role", "role");
  const text = pickRow(row, "text", "text");
  const rawCreated = pickRow(row, "created_at", "createdAt");

  const idStr = id != null ? String(id) : null;
  const orderIdStr = orderId != null ? String(orderId) : null;
  const senderIdStr = senderId != null ? String(senderId) : null;
  const textStr = text != null ? String(text) : null;

  if (!idStr || !orderIdStr || !senderIdStr || !textStr) return null;
  if (role !== "admin" && role !== "executor") return null;

  let createdAt: string;
  if (typeof rawCreated === "string") {
    const d = new Date(rawCreated);
    createdAt = Number.isNaN(d.getTime()) ? rawCreated : d.toISOString();
  } else if (rawCreated instanceof Date) {
    createdAt = rawCreated.toISOString();
  } else if (typeof rawCreated === "number") {
    createdAt = new Date(rawCreated).toISOString();
  } else {
    return null;
  }

  return {
    id: idStr,
    orderId: orderIdStr,
    senderId: senderIdStr,
    role,
    text: textStr,
    createdAt,
  };
}

function messageSortKey(m: MessageDto) {
  const t = new Date(m.createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Старые сверху, новые снизу (как в Telegram / WhatsApp). */
function sortMessagesChronological(list: MessageDto[]): MessageDto[] {
  return [...list].sort((a, b) => {
    const ta = messageSortKey(a);
    const tb = messageSortKey(b);
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });
}

function mergeById(prev: MessageDto[], incoming: MessageDto): MessageDto[] {
  if (prev.some((m) => m.id === incoming.id)) return prev;
  return sortMessagesChronological([...prev, incoming]);
}

export type OrderChatProps = {
  orderId: string;
  /**
   * Передавайте с server component (page): process.env.NEXT_PUBLIC_* —
   * на Vercel клиентский бандл иногда не получает NEXT_PUBLIC, а сервер на рантайме — да.
   */
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export function OrderChat({ orderId, supabaseUrl, supabaseAnonKey }: OrderChatProps) {
  const { data: session, status } = useSession();
  const supabase = useMemo(
    () => getSupabaseBrowserClient({ supabaseUrl, supabaseAnonKey }),
    [supabaseUrl, supabaseAnonKey],
  );

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<
    "idle" | "subscribed" | "error" | "unconfigured"
  >("idle");
  const bottomRef = useRef<HTMLDivElement>(null);
  const orderIdRef = useRef(orderId);
  orderIdRef.current = orderId;

  const currentUserId = session?.user?.id;

  const sortedMessages = useMemo(
    () => sortMessagesChronological(messages),
    [messages],
  );

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
    const data = (await res.json()) as { messages?: MessageDto[] };
    const raw = Array.isArray(data.messages) ? data.messages : [];
    setMessages(sortMessagesChronological(raw));
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
    if (!orderId || typeof orderId !== "string") return;

    if (!supabase) {
      devLog("Realtime отключён: нет URL/anon (передайте props с page или NEXT_PUBLIC_* в .env)");
      setRealtimeStatus("unconfigured");
      return;
    }

    setRealtimeStatus("idle");

    const filter = `order_id=eq.${orderId}`;
    devLog("подписка postgres_changes", { orderId, filter, table: "messages" });

    function onInsert(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      devLog("событие realtime", payload.eventType, payload);
      if (payload.eventType !== "INSERT") return;
      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const m = parseMessageFromRealtime(row);
      if (!m || m.orderId !== orderIdRef.current) {
        devLog("строка пропущена", { parsed: m, expectedOrderId: orderIdRef.current });
        return;
      }
      setMessages((prev) => mergeById(prev, m));
    }

    const channel = supabase
      .channel(`order-messages:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter,
        },
        onInsert,
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
  }, [orderId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
    const data = (await res.json()) as { message?: MessageDto };
    if (data.message) {
      setMessages((prev) => mergeById(prev, data.message!));
    }
    setInput("");
  }

  if (status === "loading") {
    return (
      <Card className="p-4 md:p-6">
        <p className="text-sm text-zinc-500">Загрузка чата…</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col p-4 md:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Чат
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Переписка по заказу между студией и исполнителем.
      </p>

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

      <div className="mt-4 flex max-h-[min(24rem,50vh)] min-h-[10rem] flex-col overflow-y-auto overflow-x-hidden rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Загрузка сообщений…</p>
        ) : sortedMessages.length === 0 ? (
          <p className="text-sm text-zinc-500">Пока нет сообщений. Напишите первым.</p>
        ) : (
          <div className="mt-auto flex min-h-0 w-full flex-col gap-2">
          {sortedMessages.map((m) => {
            const mine = currentUserId && m.senderId === currentUserId;
            const timeLabel = new Date(m.createdAt).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
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
          })}
          <div ref={bottomRef} aria-hidden className="h-0 shrink-0" />
          </div>
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
}
