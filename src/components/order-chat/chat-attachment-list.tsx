"use client";

import { useCallback, useState } from "react";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { isProbablyChatImageFileName } from "@/lib/chat-image-file";
import { cn } from "@/lib/cn";

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
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(
    null,
  );

  const images = attachments.filter((a) => isProbablyChatImageFileName(a.name));
  const files = attachments.filter((a) => !isProbablyChatImageFileName(a.name));

  const close = useCallback(() => setLightbox(null), []);

  return (
    <>
      {images.length > 0 ? (
        <ul
          className={cn(
            "grid gap-1.5",
            images.length === 1 ? "grid-cols-1" : "grid-cols-2",
            "max-w-[min(100%,20rem)]",
          )}
        >
          {images.map((a) => (
            <li key={a.fileId} className="min-w-0">
              <button
                type="button"
                className="relative block w-full overflow-hidden rounded-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-blue-400"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox({ src: fileUrl(a.fileId), name: a.name });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl(a.fileId)}
                  alt=""
                  className="h-36 w-full object-cover sm:h-44"
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
                  "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium underline-offset-2 transition-all hover:underline hover:shadow-sm",
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

      {lightbox ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={close}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.name}
            className="max-h-[min(90vh,900px)] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
