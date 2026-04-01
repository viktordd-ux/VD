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
import { postFormDataWithProgress } from "@/lib/upload-form-xhr";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { CHAT_REACTION_EMOJIS } from "@/lib/chat-reaction-emojis";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/toast-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { MessageDto } from "@/lib/message-serialize";
import { mergeMessages, removeMessageById } from "@/lib/chat-message-merge";
import {
  buildChatTimeline,
  type ChatTimelineItem,
  type MessageGroup,
} from "@/lib/chat-day-divider";
import { formatChatMessageTime } from "@/lib/chat-display-time";
import {
  normalizeCreatedAt,
  normalizeMessageDto,
  parseMessageTimestampToMs,
} from "@/lib/message-normalize";
import {
  useOrderMessagesQuery,
  type OrderMessagesQueryData,
} from "@/hooks/use-order-messages-query";
import type { ChatParticipantDto } from "@/lib/order-chat-access";
import { queryKeys } from "@/lib/query-keys";
import {
  bumpNavChatOnIncomingMessage,
  decrementNavChatOnOrderRead,
} from "@/lib/nav-badges-client";
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

function roleShortLabel(
  role: MessageDto["role"],
  senderId: string,
  participantById: Map<string, ChatParticipantDto>,
): string {
  const p = participantById.get(senderId);
  if (p) return p.kind === "staff" ? "студия" : "исполнитель";
  return role === "admin" ? "студия" : "исполнитель";
}

function getReplyPreview(target: MessageDto | undefined): string | null {
  if (!target) return null;
  const line = target.text.trim().split(/\n/)[0] ?? "";
  if (line) return line.length > 120 ? `${line.slice(0, 117)}…` : line;
  const att = target.attachments?.[0];
  if (!att) return null;
  const n = target.attachments?.length ?? 0;
  const s = n > 1 ? `${att.name} +${n - 1}` : att.name;
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

function groupMessagesBySender(
  messages: MessageDto[],
  myId: string | undefined,
): MessageGroup[] {
  const groups: MessageGroup[] = [];
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

/** Разрез группы по границе «прочитано / новое», чтобы разделитель не ломал верстку. */
function splitGroupsAtReadBoundary(
  groups: MessageGroup[],
  chatReadAtIso: string | null,
): MessageGroup[] {
  if (!chatReadAtIso) return groups;
  const readAt = parseMessageTimestampToMs(chatReadAtIso);
  if (Number.isNaN(readAt)) return groups;
  const out: MessageGroup[] = [];
  for (const g of groups) {
    const idx = g.items.findIndex(
      (m) => parseMessageTimestampToMs(m.createdAt) > readAt,
    );
    if (idx === -1) {
      out.push(g);
      continue;
    }
    if (idx === 0) {
      out.push(g);
      continue;
    }
    out.push({ ...g, items: g.items.slice(0, idx) });
    out.push({ ...g, items: g.items.slice(idx) });
  }
  return out;
}

function bubbleRadiusClass(i: number, n: number, mine: boolean): string {
  if (n === 1) return "rounded-xl";
  if (mine) {
    if (i === 0) return "rounded-xl rounded-br-md";
    if (i === n - 1) return "rounded-xl rounded-tr-md";
    return "rounded-lg rounded-r-md";
  }
  if (i === 0) return "rounded-xl rounded-bl-md";
  if (i === n - 1) return "rounded-xl rounded-tl-md";
  return "rounded-lg rounded-l-md";
}

function typingLine(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} печатает…`;
  if (names.length === 2) return `${names[0]} и ${names[1]} печатают…`;
  return `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]} печатают…`;
}

function IconSendArrow({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

const MessageBubble = memo(function MessageBubble({
  m,
  mine,
  replyPreview,
  radiusClass,
  onReply,
  onCopy,
  currentUserId,
  onToggleReaction,
}: {
  m: MessageDto;
  mine: boolean;
  replyPreview: string | null;
  radiusClass: string;
  onReply: () => void;
  onCopy: () => void;
  currentUserId?: string;
  onToggleReaction: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function onDoc(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);

  const reactions = m.reactions ?? [];
  const bodyText = m.text.trim();
  const hasAttachments = Boolean(m.attachments?.length);

  return (
    <div
      className={cn(
        "group relative w-full max-w-[min(70%,20rem)]",
        mine ? "ml-auto" : "mr-auto",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute right-1 top-1 z-[2] flex gap-0.5 opacity-0 transition-opacity duration-200 ease-out group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-sm:pointer-events-auto max-sm:opacity-100",
        )}
      >
        <button
          type="button"
          title="Ответить"
          onClick={onReply}
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm transition-transform duration-150 active:scale-[0.96]",
            mine
              ? "bg-white/15 text-white"
              : "bg-black/10 text-[var(--text)] dark:bg-white/10",
          )}
        >
          ↩
        </button>
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            title="Реакция"
            onClick={() => setPickerOpen((v) => !v)}
            className={cn(
              "rounded-md px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm transition-transform duration-150 active:scale-[0.96]",
              mine
                ? "bg-white/15 text-white"
                : "bg-black/10 text-[var(--text)] dark:bg-white/10",
            )}
          >
            +
          </button>
          {pickerOpen ? (
            <div
              className={cn(
                "pointer-events-auto absolute right-0 top-full z-30 mt-1 flex flex-wrap gap-0.5 rounded-lg border border-[color:var(--border)] bg-[var(--card)] p-1 shadow-lg shadow-black/10 vd-fade-in",
                "min-w-[7rem]",
              )}
            >
              {CHAT_REACTION_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-base transition-colors hover:bg-[color:var(--muted-bg)] active:scale-95"
                  onClick={() => {
                    onToggleReaction(em);
                    setPickerOpen(false);
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          title="Копировать"
          onClick={onCopy}
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm transition-transform duration-150 active:scale-[0.96]",
            mine
              ? "bg-white/15 text-white"
              : "bg-black/10 text-[var(--text)] dark:bg-white/10",
          )}
        >
          ⧉
        </button>
      </div>
      <div
        className={cn(
          "px-2.5 py-1.5 text-[15px] leading-snug transition-[transform,box-shadow] duration-200 ease-out",
          radiusClass,
          mine
            ? "bg-blue-600/95 text-white shadow-sm dark:bg-blue-500/95"
            : "border border-[color:var(--border)]/80 bg-[var(--card)] text-[var(--text)] shadow-sm shadow-black/[0.03] dark:shadow-none",
        )}
      >
        {m.replyToId && replyPreview ? (
          <p
            className={cn(
              "mb-1 border-l-2 pl-2 text-xs leading-snug",
              mine
                ? "border-white/40 text-blue-100/90"
                : "border-[color:var(--border)] text-[var(--muted)]",
            )}
          >
            {replyPreview}
          </p>
        ) : m.replyToId ? (
          <p className="mb-1 text-xs text-[var(--muted)]">Сообщение недоступно</p>
        ) : null}
        {bodyText ? (
          <p className="whitespace-pre-wrap break-words">
            {messageWithMentions(m.text, mine)}
          </p>
        ) : null}
        {hasAttachments ? (
          <ul
            className={cn(
              "space-y-0.5",
              bodyText ? "mt-1.5" : null,
            )}
          >
            {m.attachments!.map((a) => (
              <li key={a.fileId}>
                <a
                  href={`/api/files/${a.fileId}`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[13px] font-medium underline-offset-2 transition-colors hover:underline",
                    mine
                      ? "border-white/25 bg-white/10 text-white"
                      : "border-[color:var(--border)] bg-[color:var(--muted-bg)] text-[var(--text)]",
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="truncate">{a.name}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {reactions.length > 0
        ? (
            <div
              className={cn(
                "mt-0.5 flex flex-wrap gap-0.5",
                mine ? "justify-end" : "justify-start",
              )}
            >
              {reactions.map((r) => {
                const mineR =
                  currentUserId !== undefined &&
                  r.userIds.includes(currentUserId);
                return (
                  <button
                    key={r.emoji}
                    type="button"
                    title={mineR ? "Снять реакцию" : "Добавить такую же"}
                    onClick={() => onToggleReaction(r.emoji)}
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[12px] leading-none transition-all duration-150 ease-out hover:scale-[1.03] active:scale-[0.97]",
                      mine
                        ? mineR
                          ? "border-white/35 bg-white/15 text-white"
                          : "border-white/20 bg-white/5 text-white/90"
                        : mineR
                          ? "border-blue-400/50 bg-blue-500/15 text-[var(--text)] dark:bg-blue-500/20"
                          : "border-[color:var(--border)] bg-[color:var(--muted-bg)] text-[var(--text)]",
                    )}
                  >
                    <span>{r.emoji}</span>
                    {r.userIds.length > 1 ? (
                      <span
                        className={cn(
                          "text-[10px] tabular-nums",
                          mine ? "text-blue-100/75" : "text-[var(--muted)]",
                        )}
                      >
                        {r.userIds.length}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )
        : null}
    </div>
  );
});

function IconPaperclip({ className }: { className?: string }) {
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
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.38-8.38a4 4 0 0 1 5.66 5.66l-8.38 8.38a2 2 0 0 1-2.83-2.83l7.07-7.07" />
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
    data: chatData,
    isPending: loading,
    error: loadError,
  } = useOrderMessagesQuery(orderId, sessionReady);
  const messages = chatData?.messages ?? [];
  const participants = chatData?.participants ?? [];

  const participantById = useMemo(() => {
    const m = new Map<string, ChatParticipantDto>();
    for (const p of participants) m.set(p.userId, p);
    return m;
  }, [participants]);

  const senderNameFromMessages = useMemo(() => {
    const m = new Map<string, string>();
    for (const msg of messages) {
      if (msg.senderName && !m.has(msg.senderId)) {
        m.set(msg.senderId, msg.senderName);
      }
    }
    return m;
  }, [messages]);

  const getSenderName = useCallback(
    (senderId: string) =>
      participantById.get(senderId)?.name ??
      senderNameFromMessages.get(senderId) ??
      "Участник",
    [participantById, senderNameFromMessages],
  );

  const supabase = useMemo(
    () => getSupabaseBrowserClient({ supabaseUrl, supabaseAnonKey }),
    [supabaseUrl, supabaseAnonKey],
  );

  const [input, setInput] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>(
    [],
  );
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mentionQuery = useMemo(() => {
    const m = /(?:^|\s)@([\w\u0400-\u04FF]*)$/.exec(input);
    return m ? m[1] : null;
  }, [input]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return participants.filter((p) => p.name.toLowerCase().includes(q));
  }, [mentionQuery, participants]);

  const insertMention = useCallback((name: string) => {
    setInput((prev) => {
      const idx = prev.lastIndexOf("@");
      if (idx < 0) return `${prev}@${name} `;
      return `${prev.slice(0, idx)}@${name} `;
    });
  }, []);

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
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const scrollToUnreadDoneRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  const unreadChatCountRef = useRef(unreadChatCount);
  unreadChatCountRef.current = unreadChatCount;

  const [peerTypingNames, setPeerTypingNames] = useState<string[]>([]);
  /** Имена других участников, онлайн по presence (≈30 с окна в sync). */
  const [onlinePeerNames, setOnlinePeerNames] = useState<string[]>([]);
  const [presenceTick, setPresenceTick] = useState(0);
  const presenceChannelRef = useRef<ReturnType<
    NonNullable<ReturnType<typeof getSupabaseBrowserClient>>["channel"]
  > | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundSeenMsgIdRef = useRef<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageDto | null>(null);
  /** ISO из GET read-state — для разделителя «Новые сообщения». */
  const [chatReadAtIso, setChatReadAtIso] = useState<string | null>(null);

  const currentUserId = session?.user?.id;
  sessionUserIdRef.current = currentUserId;

  const participantSummary =
    participants.length === 0
      ? "Участники"
      : `${participants.length} участн.`;

  const messageGroups = useMemo((): MessageGroup[] => {
    const base = groupMessagesBySender(messages, currentUserId);
    return splitGroupsAtReadBoundary(base, chatReadAtIso);
  }, [messages, currentUserId, chatReadAtIso]);

  const chatTimelineWithUnread = useMemo(() => {
    const base = buildChatTimeline(messageGroups);
    const readAt = chatReadAtIso
      ? parseMessageTimestampToMs(chatReadAtIso)
      : Number.NEGATIVE_INFINITY;
    if (Number.isNaN(readAt)) return base;

    const out: Array<ChatTimelineItem | { kind: "unread" }> = [];
    let inserted = false;
    for (const item of base) {
      if (item.kind === "day") {
        out.push(item);
        continue;
      }
      const first = item.group.items[0];
      const t = parseMessageTimestampToMs(first.createdAt);
      if (!inserted && !Number.isNaN(t) && t > readAt) {
        out.push({ kind: "unread" });
        inserted = true;
      }
      out.push(item);
    }
    return out;
  }, [messageGroups, chatReadAtIso]);

  const messageById = useMemo(() => {
    const map = new Map<string, MessageDto>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  useEffect(() => {
    const id = window.setInterval(() => setPresenceTick((t) => t + 1), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const onlineSubline = useMemo(() => {
    void presenceTick;
    if (onlinePeerNames.length === 0) return "Оффлайн";
    return `В сети: ${onlinePeerNames.join(", ")}`;
  }, [onlinePeerNames, presenceTick]);

  type SendCtx = {
    previous: OrderMessagesQueryData | undefined;
    optimisticId: string;
    msgKey: ReturnType<typeof queryKeys.orderMessages>;
    previousInput: string;
    previousReplyTo: MessageDto | null;
    previousAttachments: ChatAttachment[];
  };

  const sendMutation = useMutation({
    mutationFn: async (vars: {
      text: string;
      replyToId: string | null;
      attachments: ChatAttachment[];
    }) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          text: vars.text,
          ...(vars.attachments.length
            ? { attachments: vars.attachments }
            : {}),
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
      const me = currentUserId ? participantById.get(currentUserId) : undefined;
      const role = (
        me?.kind === "staff"
          ? "admin"
          : me?.kind === "assignee"
            ? "executor"
            : (session?.user?.role as MessageDto["role"])
      ) as MessageDto["role"];
      const msgKey = queryKeys.orderMessages(orderId);
      await queryClient.cancelQueries({ queryKey: msgKey });
      const previous = queryClient.getQueryData<OrderMessagesQueryData>(msgKey);
      const previousInput = input;
      const previousReplyTo = replyTo;
      const previousAttachments = [...pendingAttachments];
      const optimisticId = `pending:${crypto.randomUUID()}`;
      const optimistic: MessageDto = {
        id: optimisticId,
        orderId,
        senderId: currentUserId!,
        role,
        text: vars.text,
        senderName: session?.user?.name?.trim() || undefined,
        /** Только для отображения до ответа сервера; порядок держит sortMessagesStable (pending после всех). */
        createdAt: new Date().toISOString(),
        replyToId: vars.replyToId,
        ...(vars.attachments.length
          ? { attachments: vars.attachments }
          : {}),
      };
      queryClient.setQueryData<OrderMessagesQueryData>(msgKey, (prev) => {
        const base = prev ?? { messages: [], participants };
        return {
          ...base,
          messages: mergeMessages(base.messages, optimistic),
        };
      });
      setInput("");
      setReplyTo(null);
      setPendingAttachments([]);
      return {
        previous,
        optimisticId,
        msgKey,
        previousInput,
        previousReplyTo,
        previousAttachments,
      } satisfies SendCtx;
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.msgKey) {
        queryClient.setQueryData(ctx.msgKey, ctx.previous);
      }
      if (ctx?.previousInput !== undefined) setInput(ctx.previousInput);
      if (ctx?.previousReplyTo !== undefined) setReplyTo(ctx.previousReplyTo);
      if (ctx?.previousAttachments !== undefined) {
        setPendingAttachments(ctx.previousAttachments);
      }
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
        queryClient.setQueryData<OrderMessagesQueryData>(ctx.msgKey, (prev) => {
          const base = prev ?? { messages: [], participants: [] };
          const without = removeMessageById(base.messages, ctx.optimisticId);
          return { ...base, messages: mergeMessages(without, added) };
        });
      } else {
        queryClient.setQueryData<OrderMessagesQueryData>(ctx.msgKey, (prev) => {
          const base = prev ?? { messages: [], participants: [] };
          return {
            ...base,
            messages: removeMessageById(base.messages, ctx.optimisticId),
          };
        });
      }
    },
  });

  type ReactionCtx = {
    previous: OrderMessagesQueryData | undefined;
    msgKey: ReturnType<typeof queryKeys.orderMessages>;
  };

  const reactionMutation = useMutation({
    mutationFn: async (vars: {
      messageId: string;
      emoji: string;
      nextActive: boolean;
    }) => {
      const res = await fetch(
        `/api/messages/${encodeURIComponent(vars.messageId)}/reactions`,
        {
          method: vars.nextActive ? "POST" : "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji: vars.emoji }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw { status: res.status, body };
      }
    },
    onMutate: async (vars) => {
      if (!currentUserId) return;
      const msgKey = queryKeys.orderMessages(orderId);
      await queryClient.cancelQueries({ queryKey: msgKey });
      const previous = queryClient.getQueryData<OrderMessagesQueryData>(msgKey);
      queryClient.setQueryData<OrderMessagesQueryData>(msgKey, (old) => {
        if (!old) return old;
        const nextMessages = old.messages.map((msg) => {
          if (msg.id !== vars.messageId) return msg;
          const list = [...(msg.reactions ?? [])];
          const idx = list.findIndex((x) => x.emoji === vars.emoji);
          if (vars.nextActive) {
            if (idx === -1) {
              list.push({ emoji: vars.emoji, userIds: [currentUserId] });
            } else {
              const uids = new Set(list[idx]!.userIds);
              uids.add(currentUserId);
              list[idx] = { emoji: vars.emoji, userIds: [...uids] };
            }
          } else if (idx >= 0) {
            const uids = list[idx]!.userIds.filter((u) => u !== currentUserId);
            if (uids.length === 0) list.splice(idx, 1);
            else list[idx] = { emoji: vars.emoji, userIds: uids };
          }
          return {
            ...msg,
            reactions: list.length ? list : undefined,
          };
        });
        return { ...old, messages: nextMessages };
      });
      return { previous, msgKey } satisfies ReactionCtx;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined && ctx.msgKey) {
        queryClient.setQueryData(ctx.msgKey, ctx.previous);
      }
      toast.error("Не удалось сохранить реакцию");
    },
  });

  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (!currentUserId || reactionMutation.isPending) return;
      const msg = messages.find((x) => x.id === messageId);
      const agg = msg?.reactions?.find((r) => r.emoji === emoji);
      const has = agg?.userIds.includes(currentUserId);
      reactionMutation.mutate({
        messageId,
        emoji,
        nextActive: !has,
      });
    },
    [currentUserId, messages, reactionMutation.mutate, reactionMutation.isPending],
  );

  const uploadChatFile = useCallback(
    async (file: File) => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Файл слишком большой (макс. 50 МБ)");
        return;
      }
      setFileUploading(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const { ok, body } = await postFormDataWithProgress(
          `/api/orders/${encodeURIComponent(orderId)}/files`,
          fd,
          () => {
            /* progress optional */
          },
        );
        if (!ok) {
          const err = body as { error?: string };
          toast.error(err?.error ?? "Не удалось загрузить файл");
          return;
        }
        const row = body as { id?: string };
        const id = row.id != null ? String(row.id) : "";
        if (!id) {
          toast.error("Некорректный ответ сервера");
          return;
        }
        setPendingAttachments((prev) => [
          ...prev,
          { type: "file", fileId: id, name: file.name },
        ]);
      } catch {
        toast.error("Ошибка загрузки файла");
      } finally {
        setFileUploading(false);
      }
    },
    [orderId, toast],
  );

  const dockFabPos =
    dockFabBottom === "default"
      ? "fixed right-3 z-[90] bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] lg:bottom-6"
      : "fixed right-3 z-[90] max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6";

  const fetchUnread = useCallback(async () => {
    const res = await fetch(
      `/api/orders/${encodeURIComponent(orderId)}/read-state`,
      { cache: "no-store" },
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      hasUnreadChat?: boolean;
      unreadChatCount?: number;
      chatReadAt?: string | null;
    };
    const n = Math.max(0, Number(data.unreadChatCount ?? 0));
    if (Number.isFinite(n)) {
      setUnreadChatCount(n);
    } else {
      setUnreadChatCount(data.hasUnreadChat ? 1 : 0);
    }
    if (typeof data.chatReadAt === "string" || data.chatReadAt === null) {
      setChatReadAtIso(data.chatReadAt ?? null);
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
    scrollToUnreadDoneRef.current = false;
    setChatReadAtIso(null);
    setOnlinePeerNames([]);
    setPeerTypingNames([]);
    setReplyTo(null);
    setPendingAttachments([]);
  }, [orderId]);

  useEffect(() => {
    if (status === "loading") return;
    void fetchUnread();
    const id = setInterval(() => void fetchUnread(), 60_000);
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
        Array<{
          userId?: string;
          lastSeen?: number;
          typing?: boolean;
          typing_ts?: number;
          name?: string;
        }>
      >;
      const now = Date.now();
      const onlineNames: string[] = [];
      const typingLabels: string[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === currentUserId) continue;
        const meta = Array.isArray(metas) ? metas[0] : undefined;
        const ls = typeof meta?.lastSeen === "number" ? meta.lastSeen : 0;
        if (ls > 0 && now - ls < 30_000) {
          const n = typeof meta?.name === "string" ? meta.name.trim() : "";
          onlineNames.push(n || "Участник");
        }
        const ts = typeof meta?.typing_ts === "number" ? meta.typing_ts : 0;
        if (meta?.typing && now - ts < 4000) {
          const n = typeof meta.name === "string" ? meta.name.trim() : "";
          typingLabels.push(n || "Участник");
        }
      }
      setOnlinePeerNames([...new Set(onlineNames)]);
      setPeerTypingNames([...new Set(typingLabels)]);
    });

    const trackIdlePresence = () => {
      void presenceCh.track({
        userId: currentUserId,
        lastSeen: Date.now(),
        typing: false,
        typing_ts: 0,
        name: session?.user?.name ?? undefined,
      });
    };

    presenceCh.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        presenceChannelRef.current = presenceCh;
        trackIdlePresence();
      }
    });

    const hb = window.setInterval(trackIdlePresence, 18_000);

    return () => {
      window.clearInterval(hb);
      presenceChannelRef.current = null;
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
      void supabase.removeChannel(presenceCh);
    };
  }, [supabase, orderId, currentUserId, session?.user?.name]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== "visible") return;
      const ch = presenceChannelRef.current;
      if (!ch || !currentUserId) return;
      void ch.track({
        userId: currentUserId,
        lastSeen: Date.now(),
        typing: false,
        typing_ts: 0,
        name: session?.user?.name ?? undefined,
      });
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [currentUserId, session?.user?.name]);

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
    if (document.hidden) {
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
    const hadUnread = unreadChatCountRef.current > 0;
    setUnreadChatCount(0);
    void (async () => {
      await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markChat: true }),
      });
      await fetchUnread();
      if (hadUnread) {
        decrementNavChatOnOrderRead(queryClient, orderId);
      }
      dispatchOrderUnreadChanged();
    })();
  }, [isDock, dockOpen, orderId, fetchUnread, queryClient]);

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
          const hadUnread = unreadChatCountRef.current > 0;
          setUnreadChatCount(0);
          void (async () => {
            await fetch(`/api/orders/${encodeURIComponent(orderId)}/read-state`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ markChat: true }),
            });
            await fetchUnread();
            if (hadUnread) {
              decrementNavChatOnOrderRead(queryClient, orderId);
            }
            dispatchOrderUnreadChanged();
          })();
        }
        prevHit = hit;
      },
      { threshold: [0, 0.15, 0.25, 0.5] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [isDock, orderId, fetchUnread, queryClient]);

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
        queryClient.setQueryData<OrderMessagesQueryData>(msgKey, (prev) => {
          const base = prev ?? { messages: [], participants: [] };
          return {
            ...base,
            messages: removeMessageById(base.messages, id),
          };
        });
        return;
      }

      const row = payload.new as Record<string, unknown> | null;
      if (!row) return;
      // Время только из БД: payload.new.created_at (Realtime postgres_changes)
      let m = normalizeMessageDto(row);
      if (!m || m.orderId !== orderIdRef.current) {
        devLog("строка пропущена", { parsed: m, expectedOrderId: orderIdRef.current });
        return;
      }
      queryClient.setQueryData<OrderMessagesQueryData>(msgKey, (prev) => {
        const base = prev ?? { messages: [], participants: [] };
        const list = base.messages;
        const pmeta = base.participants.find((x) => x.userId === m!.senderId);
        if (pmeta && !m!.senderName) {
          m = { ...m!, senderName: pmeta.name };
        }
        const uid = sessionUserIdRef.current;
        if (uid != null && m!.senderId === uid) {
          const pending = list.find(
            (x) =>
              x.id.startsWith("pending:") &&
              x.senderId === uid &&
              x.text === m!.text &&
              (x.replyToId ?? null) === (m!.replyToId ?? null) &&
              JSON.stringify(x.attachments ?? []) ===
                JSON.stringify(m!.attachments ?? []),
          );
          if (pending) {
            return {
              ...base,
              messages: mergeMessages(removeMessageById(list, pending.id), m!),
            };
          }
        }
        return { ...base, messages: mergeMessages(list, m!) };
      });
      const uid = sessionUserIdRef.current;
      const fromOther = uid != null && m.senderId !== uid;
      if (!fromOther) return;
      if (variant === "dock" && !dockOpenRef.current) {
        bumpNavChatOnIncomingMessage(queryClient, orderId, uid, m.senderId);
        void fetchUnread();
        dispatchOrderUnreadChanged();
        return;
      }
      if (variant !== "dock" && !chatSectionVisibleRef.current) {
        bumpNavChatOnIncomingMessage(queryClient, orderId, uid, m.senderId);
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

  /** Скролл к «Новые сообщения» один раз; иначе вниз — только если пользователь у низа / своё / первая загрузка / dock. */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (loading) return;

    if (
      !scrollToUnreadDoneRef.current &&
      initialHasUnreadChat &&
      messages.length > 0 &&
      unreadDividerRef.current
    ) {
      unreadDividerRef.current.scrollIntoView({ block: "center", behavior: "auto" });
      scrollToUnreadDoneRef.current = true;
      nearBottomRef.current = false;
      return;
    }

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
  }, [
    lastMessageKey,
    loading,
    currentUserId,
    dockOpen,
    isDock,
    messages,
    initialHasUnreadChat,
    chatTimelineWithUnread,
  ]);

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
    if (
      (!text && pendingAttachments.length === 0) ||
      sendMutation.isPending ||
      !currentUserId
    ) {
      return;
    }
    if (chatLoadError) return;
    sendMutation.mutate({
      text,
      replyToId: replyTo?.id ?? null,
      attachments: pendingAttachments,
    });
  }

  useEffect(() => {
    if (!isDock || !dockOpen) return;
    const id = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [isDock, dockOpen, orderId]);

  const syncInputHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(120, Math.max(36, el.scrollHeight));
    el.style.height = `${next}px`;
  }, []);

  useLayoutEffect(() => {
    syncInputHeight();
  }, [input, syncInputHeight]);

  const tallMessages = isSidebar || isDock;

  function dockShell(node: ReactNode) {
    if (!isDock) return node;
    return (
      <div
        className={cn(
          dockFabPos,
          "flex w-[min(22rem,calc(100vw-0.75rem))] flex-col",
          "h-[min(42rem,70vh)] max-h-[calc(100dvh-1rem)]",
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
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--text)] text-[var(--bg)] shadow-lg shadow-black/20 ring-2 ring-[var(--border)] transition hover:opacity-90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:ring-white/20"
          aria-label={
            unreadChatCount > 0
              ? `Открыть чат — непрочитанных: ${unreadChatCount}`
              : "Открыть чат по заказу"
          }
        >
          <IconChatBubble className="h-7 w-7" />
          {unreadChatCount > 0 ? (
            <span
              className="absolute -right-1 -top-1 z-10 flex h-[22px] min-w-[22px] items-center justify-center overflow-visible rounded-full border-2 border-[var(--text)] bg-red-500 px-1 text-[11px] font-bold leading-none text-white dark:border-white"
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
          "flex h-full min-h-0 flex-col overflow-hidden p-0 shadow-none",
          isSidebar && "min-h-[12rem] lg:max-h-[calc(100dvh-2rem)]",
          isDock &&
            "flex-1 rounded-2xl border border-[color:var(--border)] ring-1 ring-black/[0.04] dark:ring-white/10",
        )}
      >
        {isDock && (
          <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--border)] px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Чат
            </span>
            <button
              type="button"
              onClick={() => setDockOpen(false)}
              className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[color:var(--muted-bg)] hover:text-[var(--text)]"
              aria-label="Свернуть чат"
            >
              <IconChevronDown className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-4">
          <div className="flex justify-end">
            <Skeleton className="h-10 w-[min(70%,18rem)] rounded-[16px]" />
          </div>
          <div className="flex justify-start gap-2">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className="h-14 w-[min(70%,20rem)] rounded-[16px]" />
          </div>
          <div className="flex justify-end">
            <Skeleton className="h-9 w-[55%] max-w-xs rounded-[16px]" />
          </div>
        </div>
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
        "flex h-full min-h-0 flex-col overflow-hidden p-0 shadow-none",
        isSidebar &&
          "min-h-[18rem] max-h-[min(32rem,70vh)] lg:min-h-0 lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden",
        isDock &&
          "min-h-0 flex-1 rounded-2xl border border-[color:var(--border)] ring-1 ring-black/[0.04] dark:ring-white/10",
        !isDock && !isSidebar && "min-h-[min(28rem,min(72vh,36rem))]",
      )}
    >
      {isDock ? (
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[color:var(--border)] px-2 py-1.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Чат
              </h2>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-[var(--muted)]">
              <span className="font-medium text-[var(--text)]">{participantSummary}</span>
              <span className="mx-1">·</span>
              {onlinePeerNames.length > 0 ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {onlineSubline}
                </span>
              ) : (
                <span>{onlineSubline}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDockOpen(false)}
            className="shrink-0 rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[color:var(--muted-bg)] hover:text-[var(--text)]"
            aria-label="Свернуть чат"
          >
            <IconChevronDown className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="shrink-0 border-b border-[color:var(--border)] px-2 py-1.5">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5">
            <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Чат
              {unreadChatCount > 0 ? (
                <span
                  className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
                  aria-hidden
                >
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </span>
              ) : null}
            </h2>
            <span className="text-[11px] text-[var(--muted)]">
              {participantSummary} · {onlineSubline}
            </span>
          </div>
        </div>
      )}

      {participants.length > 0 ? (
        <div className="flex max-h-16 shrink-0 flex-wrap gap-1.5 overflow-y-auto border-b border-[color:var(--border)] px-2 py-1.5">
          {participants.map((p) => (
            <div
              key={p.userId}
              className="flex max-w-[11rem] items-center gap-1 rounded-full border border-[color:var(--border)]/80 bg-[color:var(--muted-bg)] px-1.5 py-0.5 text-[10px]"
            >
              <Avatar size="sm" name={p.name} seed={p.userId} />
              <span className="min-w-0 truncate font-medium text-[var(--text)]">{p.name}</span>
              <span className="shrink-0 text-[var(--muted)]">
                {p.kind === "staff" ? "студия" : "исполн."}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {peerTypingNames.length > 0 ? (
        <div
          className="shrink-0 border-b border-[color:var(--border)] bg-blue-500/[0.06] px-2.5 py-1.5 text-[12px] font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
          role="status"
          aria-live="polite"
        >
          {typingLine(peerTypingNames)}
        </div>
      ) : null}

      {realtimeStatus === "unconfigured" && (
        <p className="border-b border-amber-200/60 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          Мгновенные обновления выключены: в Vercel задайте{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">NEXT_PUBLIC_SUPABASE_URL</code> и{" "}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          (как в Supabase → Settings → API) и сделайте <strong>Redeploy</strong>.
        </p>
      )}
      {realtimeStatus === "error" && (
        <p className="border-b border-amber-200/60 bg-amber-50/90 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          Не удалось подключить Realtime. В Supabase:{" "}
          <strong>Database → Publications</strong> или <strong>Replication</strong> — включите
          таблицу <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/60">messages</code> для Realtime.
        </p>
      )}

      {chatLoadError && (
        <p className="border-b border-red-200 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:text-red-300" role="alert">
          {chatLoadError}
        </p>
      )}

      <div
        ref={scrollRef}
        style={{ overflowAnchor: "none" } as CSSProperties}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[var(--bg)] px-1.5 pt-1 pb-0.5 [scrollbar-gutter:stable]",
          tallMessages ? "min-h-0" : "max-h-[min(28rem,60vh)]",
        )}
      >
        {loading ? (
          <div className="flex flex-col gap-1.5 py-1" aria-hidden>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-[min(70%,18rem)] rounded-[16px]" />
            </div>
            <div className="flex justify-start gap-2">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <Skeleton className="h-14 w-[min(70%,20rem)] rounded-[16px]" />
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-9 w-[55%] max-w-xs rounded-[16px]" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-2 text-center text-sm text-[var(--muted)]">
            Пока нет сообщений. Напишите первым.
          </p>
        ) : (
          chatTimelineWithUnread.map((item, ti) => {
            if (item.kind === "unread") {
              return (
                <div
                  key={`unread-${ti}`}
                  ref={unreadDividerRef}
                  className="flex items-center gap-2 py-1 vd-fade-in"
                >
                  <div className="h-px flex-1 bg-blue-500/35 dark:bg-blue-400/30" />
                  <span className="shrink-0 rounded-full bg-blue-500/12 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    Новые сообщения
                  </span>
                  <div className="h-px flex-1 bg-blue-500/35 dark:bg-blue-400/30" />
                </div>
              );
            }
            if (item.kind === "day") {
              return (
                <div
                  key={`day-${item.dayKey}-${ti}`}
                  className="flex items-center gap-2 py-1 vd-fade-in"
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
            const displayName = getSenderName(g.senderId);
            const groupTime = last.id.startsWith("pending:")
              ? ""
              : formatChatMessageTime(last.createdAt);
            const roleLabel = !g.mine
              ? roleShortLabel(g.role, g.senderId, participantById)
              : null;
            return (
              <div
                key={`${g.senderId}-${ti}-${last.id}`}
                className="vd-message-enter pb-0"
              >
                {!g.mine ? (
                  <span className="mb-0.5 block pl-0.5 text-[11px] font-semibold leading-tight text-[var(--text)]">
                    {displayName}
                  </span>
                ) : null}
                <div
                  className={cn(
                    "flex gap-1.5",
                    g.mine ? "flex-row-reverse items-end" : "flex-row items-end",
                  )}
                >
                  {!g.mine ? (
                    <div className="flex w-9 shrink-0 flex-col justify-end">
                      <Avatar
                        size="md"
                        name={displayName}
                        seed={g.senderId}
                        ringClassName="ring-2 ring-[var(--bg)]"
                      />
                    </div>
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {g.items.map((m, mi) => (
                      <MessageBubble
                        key={m.id}
                        m={m}
                        mine={g.mine}
                        radiusClass={bubbleRadiusClass(mi, g.items.length, g.mine)}
                        replyPreview={getReplyPreview(
                          m.replyToId ? messageById.get(m.replyToId) : undefined,
                        )}
                        onReply={() => setReplyTo(m)}
                        onCopy={() => {
                          const t = m.text.trim();
                          const names = m.attachments?.map((a) => a.name).join(", ");
                          const line =
                            t || (names ? `Вложения: ${names}` : "");
                          void navigator.clipboard.writeText(line).then(() => {
                            toast.success("Скопировано");
                          });
                        }}
                        currentUserId={currentUserId}
                        onToggleReaction={(emoji) => toggleReaction(m.id, emoji)}
                      />
                    ))}
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-0.5 flex text-[11px] tabular-nums leading-none text-[var(--muted)]",
                    g.mine
                      ? "justify-end pr-0.5"
                      : "justify-start pl-[calc(2.25rem+0.375rem)]",
                  )}
                >
                  {!g.mine && roleLabel ? (
                    <>
                      {roleLabel}
                      {groupTime ? " · " : null}
                    </>
                  ) : null}
                  {groupTime}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={onSend}
        className="z-10 shrink-0 border-t border-[color:var(--border)] bg-[var(--card)] px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-1"
      >
        <label className="sr-only" htmlFor={`order-chat-input-${orderId}`}>
          Сообщение
        </label>
        {replyTo ? (
          <div className="mb-1.5 flex w-full items-center justify-between gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-2.5 py-1 text-left text-[11px] text-[var(--muted)]">
            <p className="min-w-0 truncate">
              <span className="font-medium text-[var(--text)]">Ответ: </span>
              {getReplyPreview(replyTo) ?? "…"}
            </p>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="shrink-0 rounded-lg px-2 py-0.5 text-[var(--text)] transition hover:bg-[color:var(--border)]"
              aria-label="Отменить ответ"
            >
              ✕
            </button>
          </div>
        ) : null}
        {pendingAttachments.length > 0 ? (
          <div className="mb-1.5 flex flex-wrap gap-1 px-0.5">
            {pendingAttachments.map((a) => (
              <span
                key={a.fileId}
                className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-2 py-0.5 text-[11px] text-[var(--text)]"
              >
                <span className="min-w-0 truncate">{a.name}</span>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-[var(--muted)] transition hover:bg-[color:var(--border)] hover:text-[var(--text)]"
                  onClick={() =>
                    setPendingAttachments((prev) =>
                      prev.filter((x) => x.fileId !== a.fileId),
                    )
                  }
                  aria-label="Убрать вложение"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void uploadChatFile(f);
          }}
        />
        <div className="relative rounded-2xl border border-[color:var(--border)] bg-[var(--bg)] pl-10 pr-[3.25rem] py-2 dark:bg-[var(--muted-bg)]">
          <button
            type="button"
            className="absolute bottom-1.5 left-1.5 z-[1] flex h-10 w-10 touch-manipulation items-center justify-center rounded-full text-[var(--muted)] transition-all duration-150 hover:bg-[color:var(--muted-bg)] hover:text-[var(--text)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
            aria-label="Прикрепить файл"
            disabled={fileUploading || Boolean(chatLoadError)}
            onClick={() => fileInputRef.current?.click()}
          >
            {fileUploading ? (
              <Skeleton className="h-4 w-4 shrink-0 rounded-full bg-[color:var(--skeleton)]" />
            ) : (
              <IconPaperclip className="h-[18px] w-[18px]" />
            )}
          </button>
          {mentionQuery !== null && mentionCandidates.length > 0 ? (
            <ul
              className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-36 overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[var(--card)] py-1 shadow-lg shadow-black/10"
              role="listbox"
              aria-label="Упоминание участника"
            >
              {mentionCandidates.map((p) => (
                <li key={p.userId}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[color:var(--muted-bg)]"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(p.name);
                    }}
                  >
                    <Avatar size="sm" name={p.name} seed={p.userId} />
                    <span className="min-w-0 truncate">{p.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-[var(--muted)]">
                      {p.kind === "staff" ? "студия" : "исполн."}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <textarea
            ref={textareaRef}
            id={`order-chat-input-${orderId}`}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const ch = presenceChannelRef.current;
              if (!ch || !currentUserId) return;
              if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
              typingDebounceRef.current = setTimeout(() => {
                void ch.track({
                  userId: currentUserId,
                  lastSeen: Date.now(),
                  typing: true,
                  typing_ts: Date.now(),
                  name: session?.user?.name ?? undefined,
                });
              }, 600);
              if (typingIdleTimerRef.current) clearTimeout(typingIdleTimerRef.current);
              typingIdleTimerRef.current = setTimeout(() => {
                void ch.track({
                  userId: currentUserId,
                  lastSeen: Date.now(),
                  typing: false,
                  typing_ts: 0,
                  name: session?.user?.name ?? undefined,
                });
              }, 2800);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend(e as unknown as React.FormEvent);
              }
            }}
            placeholder="Сообщение"
            rows={1}
            maxLength={8000}
            className="max-h-[120px] min-h-[40px] w-full resize-none border-0 bg-transparent py-0.5 pr-0 text-[15px] leading-snug text-[var(--text)] outline-none ring-0 placeholder:text-[var(--muted)] focus:ring-0"
          />
          <button
            type="submit"
            disabled={
              sendMutation.isPending ||
              fileUploading ||
              (!input.trim() && pendingAttachments.length === 0) ||
              !currentUserId
            }
            className="absolute bottom-1.5 right-1.5 flex h-10 w-10 touch-manipulation items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition duration-150 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:bg-blue-500 dark:hover:bg-blue-400"
            aria-label="Отправить"
          >
            {sendMutation.isPending ? (
              <Skeleton className="h-4 w-4 shrink-0 rounded-full bg-[color:var(--skeleton)]" />
            ) : (
              <IconSendArrow className="h-[18px] w-[18px]" />
            )}
          </button>
        </div>
      </form>
    </Card>
  );

  return dockShell(
    isDock ? chatCard : <div ref={cardRef} className="w-full">{chatCard}</div>,
  );
}
