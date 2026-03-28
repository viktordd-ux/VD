"use client";

import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MessageDto } from "@/lib/message-serialize";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";

function parseMessageFromRealtime(
  row: Record<string, unknown>,
): MessageDto | null {
  const id = row.id != null ? String(row.id) : null;
  const orderId = row.order_id != null ? String(row.order_id) : null;
  const senderId = row.sender_id != null ? String(row.sender_id) : null;
  const role = row.role;
  const text = row.text != null ? String(row.text) : null;
  const rawCreated = row.created_at;
  if (!id || !orderId || !senderId || !text) return null;
  if (role !== "admin" && role !== "executor") return null;
  let createdAt: string;
  if (typeof rawCreated === "string") {
    createdAt = rawCreated;
  } else if (rawCreated instanceof Date) {
    createdAt = rawCreated.toISOString();
  } else {
    return null;
  }
  return { id, orderId, senderId, role, text, createdAt };
}

function mergeById(prev: MessageDto[], incoming: MessageDto): MessageDto[] {
  if (prev.some((m) => m.id === incoming.id)) return prev;
  return [...prev, incoming].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export function OrderChat({ orderId }: { orderId: string }) {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentUserId = session?.user?.id;

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
    setMessages(Array.isArray(data.messages) ? data.messages : []);
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
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    function onInsert(
      payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
    ) {
      if (payload.eventType !== "INSERT") return;
      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      const m = parseMessageFromRealtime(row);
      if (!m || m.orderId !== orderId) return;
      setMessages((prev) => mergeById(prev, m));
    }

    const channel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${orderId}`,
        },
        onInsert,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

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

      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 max-h-[min(24rem,50vh)] min-h-[10rem] space-y-2 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
        {loading ? (
          <p className="text-sm text-zinc-500">Загрузка сообщений…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-zinc-500">Пока нет сообщений. Напишите первым.</p>
        ) : (
          messages.map((m) => {
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
          })
        )}
        <div ref={bottomRef} />
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
