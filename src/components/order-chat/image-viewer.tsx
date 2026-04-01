"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Props = {
  src: string;
  name: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
};

/** Просмотр изображения в приложении: оверлей, зум колесом, перетаскивание при zoom&gt;1, свайп вниз — закрыть. */
export function ImageViewer({ src, name, onClose, onPrev, onNext }: Props) {
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(
    null,
  );
  const swipe = useRef<{ y0: number; x0: number } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = Math.min(4, Math.max(1, s * (e.deltaY < 0 ? 1.1 : 0.91)));
        if (next <= 1) {
          setTx(0);
          setTy(0);
        }
        return next;
      });
    },
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[240] flex flex-col bg-black/88 backdrop-blur-sm"
      role="dialog"
      aria-label={name}
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <p className="min-w-0 truncate text-xs font-medium text-white/90">{name}</p>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-[11px] font-medium text-white/90 transition hover:bg-white/10"
          onClick={(e) => {
            e.stopPropagation();
            setScale(1);
            setTx(0);
            setTy(0);
          }}
        >
          Сброс
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2"
        onWheel={onWheel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={name}
          draggable={false}
          className={cn(
            "max-h-[min(88vh,920px)] max-w-full select-none rounded-xl object-contain shadow-2xl",
            scale > 1 ? "cursor-grab" : "cursor-zoom-in",
          )}
          style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          onMouseDown={(e) => {
            if (scale <= 1) return;
            pan.current = {
              sx: e.clientX,
              sy: e.clientY,
              ox: tx,
              oy: ty,
            };
          }}
          onMouseMove={(e) => {
            const p = pan.current;
            if (!p || scale <= 1) return;
            setTx(p.ox + (e.clientX - p.sx));
            setTy(p.oy + (e.clientY - p.sy));
          }}
          onMouseUp={() => {
            pan.current = null;
          }}
          onMouseLeave={() => {
            pan.current = null;
          }}
          onTouchStart={(e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0]!;
            swipe.current = { y0: t.clientY, x0: t.clientX };
            if (scale > 1) {
              pan.current = {
                sx: t.clientX,
                sy: t.clientY,
                ox: tx,
                oy: ty,
              };
            }
          }}
          onTouchMove={(e) => {
            if (e.touches.length !== 1) return;
            const t = e.touches[0]!;
            const s = swipe.current;
            if (scale > 1 && pan.current) {
              const p = pan.current;
              setTx(p.ox + (t.clientX - p.sx));
              setTy(p.oy + (t.clientY - p.sy));
              return;
            }
            if (scale <= 1.02 && s) {
              const dy = t.clientY - s.y0;
              const dx = t.clientX - s.x0;
              if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
                setTy(dy * 0.45);
              }
            }
          }}
          onTouchEnd={(e) => {
            const t = e.changedTouches[0];
            if (scale <= 1.02 && t && swipe.current) {
              const dy = t.clientY - swipe.current.y0;
              if (dy > 90) onClose();
            }
            swipe.current = null;
            pan.current = null;
            if (scale <= 1.02) setTy(0);
          }}
        />
      </div>
      {(onPrev || onNext) && (
        <p className="pb-[max(0.5rem,env(safe-area-inset-bottom))] text-center text-[10px] text-white/45">
          ← → соседние · свайп вниз — закрыть
        </p>
      )}
    </div>
  );
}
