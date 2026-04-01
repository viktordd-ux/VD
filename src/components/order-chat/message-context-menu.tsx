"use client";

import { CHAT_REACTION_EMOJIS } from "@/lib/chat-reaction-emojis";
import { cn } from "@/lib/cn";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

const PAD = 8;
const GAP = 6;

function placeFixedMenu(
  anchor: DOMRect,
  menuW: number,
  menuH: number,
  mine: boolean,
): { top: number; left: number } {
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let left = mine ? anchor.right - menuW : anchor.left;
  left = Math.max(PAD, Math.min(left, vw - menuW - PAD));

  let top = anchor.top - menuH - GAP;
  if (top < PAD) {
    top = anchor.bottom + GAP;
  }
  if (top + menuH > vh - PAD) {
    top = Math.max(PAD, vh - menuH - PAD);
  }
  return { top, left };
}

export type MessageContextMenuProps = {
  open: boolean;
  anchorRect: DOMRect | null;
  mine: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onToggleReaction: (emoji: string) => void;
  onDelete?: () => void;
};

export function MessageContextMenu({
  open,
  anchorRect,
  mine,
  onClose,
  onReply,
  onCopy,
  onToggleReaction,
  onDelete,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) setReactionOpen(false);
  }, [open]);

  const reposition = useCallback(() => {
    const el = menuRef.current;
    const ar = anchorRect;
    if (!el || !ar) return;
    const { width: mw, height: mh } = el.getBoundingClientRect();
    if (mw < 1 || mh < 1) return;
    setPos(placeFixedMenu(ar, mw, mh, mine));
  }, [anchorRect, mine]);

  useLayoutEffect(() => {
    if (!open || !anchorRect) return;
    reposition();
  }, [open, anchorRect, reactionOpen, reposition]);

  useEffect(() => {
    if (!open) return;
    const ro = new ResizeObserver(() => reposition());
    const el = menuRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onResize() {
      reposition();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, reposition]);

  if (typeof document === "undefined" || !open || !anchorRect) return null;

  const menu = (
    <>
      <button
        type="button"
        aria-label="Закрыть меню"
        className="fixed inset-0 z-[100] cursor-default border-0 bg-black/25 p-0 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Действия с сообщением"
        className={cn(
          "vd-message-context-menu-enter fixed z-[101] max-h-[min(70vh,520px)] w-[min(calc(100vw-16px),220px)] overflow-y-auto rounded-xl border border-[color:var(--border)] bg-[var(--card)] py-1 shadow-xl shadow-black/20 dark:shadow-black/50",
        )}
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[15px] leading-tight text-[var(--text)] active:bg-[color:var(--muted-bg)]"
          onClick={() => {
            onReply();
            onClose();
          }}
        >
          Ответить
        </button>
        <div className="border-t border-[color:var(--border)]/80">
          <button
            type="button"
            role="menuitem"
            aria-expanded={reactionOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[15px] leading-tight text-[var(--text)] active:bg-[color:var(--muted-bg)]"
            onClick={() => setReactionOpen((v) => !v)}
          >
            <span>Реакция</span>
            <span className="text-[var(--muted)]" aria-hidden>
              {reactionOpen ? "▾" : "▸"}
            </span>
          </button>
          {reactionOpen ? (
            <div className="flex flex-wrap gap-1 border-t border-[color:var(--border)]/60 px-2 pb-2 pt-1.5">
              {CHAT_REACTION_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-lg active:bg-[color:var(--muted-bg)]"
                  onClick={() => {
                    onToggleReaction(em);
                    onClose();
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
          role="menuitem"
          className="flex w-full items-center gap-2 border-t border-[color:var(--border)]/80 px-3 py-2.5 text-left text-[15px] leading-tight text-[var(--text)] active:bg-[color:var(--muted-bg)]"
          onClick={() => {
            onCopy();
            onClose();
          }}
        >
          Копировать
        </button>
        {onDelete ? (
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-t border-red-500/20 px-3 py-2.5 text-left text-[15px] leading-tight text-red-600 active:bg-red-500/10 dark:text-red-400"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Удалить
          </button>
        ) : null}
      </div>
    </>
  );

  return createPortal(menu, document.body);
}
