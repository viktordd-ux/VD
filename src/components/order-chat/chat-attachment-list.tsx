"use client";

import { useCallback, useMemo, useState } from "react";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { isChatImageAttachment } from "@/lib/chat-attachment-display";
import { cn } from "@/lib/cn";
import { ImageViewer } from "@/components/order-chat/image-viewer";

function fileUrl(fileId: string): string {
  return `/api/files/${encodeURIComponent(fileId)}`;
}

export function ChatAttachmentList({
  attachments,
  mine,
}: {
  attachments: ChatAttachment[];
  mine: boolean;
}) {
  const [viewer, setViewer] = useState<{
    index: number;
    items: ChatAttachment[];
  } | null>(null);

  const images = useMemo(
    () => attachments.filter((a) => isChatImageAttachment(a)),
    [attachments],
  );
  const files = useMemo(
    () => attachments.filter((a) => !isChatImageAttachment(a)),
    [attachments],
  );

  const close = useCallback(() => setViewer(null), []);

  const openAt = useCallback((i: number) => {
    if (images.length === 0) return;
    setViewer({ index: i, items: images });
  }, [images]);

  return (
    <>
      {images.length > 0 ? (
        <ul
          className={cn(
            "grid gap-1.5",
            images.length === 1 ? "grid-cols-1" : "grid-cols-2",
            "max-w-[min(100%,22rem)]",
          )}
        >
          {images.map((a, i) => (
            <li key={a.fileId} className="min-w-0">
              <button
                type="button"
                className="relative block w-full max-h-[240px] overflow-hidden rounded-xl focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-400 transition-transform duration-[140ms] ease-out hover:scale-[1.01] active:scale-[0.98]"
                onClick={(e) => {
                  e.stopPropagation();
                  openAt(i);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(a.fileId)}
                  alt=""
                  className="max-h-[240px] w-full object-cover"
                  loading="lazy"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length > 0 ? (
        <ul
          className={cn(
            "space-y-1",
            images.length > 0 ? "mt-1.5" : null,
          )}
        >
          {files.map((a) => (
            <li key={a.fileId}>
              <a
                href={fileUrl(a.fileId)}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium underline-offset-2 transition-all duration-[140ms] ease-out hover:underline hover:shadow-sm hover:scale-[1.01] active:scale-[0.98]",
                  mine
                    ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                    : "border-[color:var(--border)] bg-[color:var(--muted-bg)] text-[var(--text)] hover:bg-[color:var(--surface-hover)]",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-3.5 w-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                <span className="truncate">{a.name}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {viewer ? (
        <ImageViewer
          src={fileUrl(viewer.items[viewer.index]!.fileId)}
          name={viewer.items[viewer.index]!.name}
          onClose={close}
          onPrev={
            viewer.index > 0
              ? () =>
                  setViewer((v) =>
                    v ? { ...v, index: v.index - 1 } : v,
                  )
              : undefined
          }
          onNext={
            viewer.index < viewer.items.length - 1
              ? () =>
                  setViewer((v) =>
                    v ? { ...v, index: v.index + 1 } : v,
                  )
              : undefined
          }
        />
      ) : null}
    </>
  );
}
