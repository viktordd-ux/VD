"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastVariant = "success" | "error" | "info" | "action";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type PushFn = (message: string, variant?: ToastVariant) => void;

type ToastContextValue = {
  push: PushFn;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Низкоуровневый push (вариант по умолчанию — info). */
export function useAppToast(): PushFn {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return () => {};
  }
  return ctx.push;
}

/** Системные тосты: успех / ошибка / нейтральное действие. */
export function useToast() {
  const push = useAppToast();
  return useMemo(
    () => ({
      success: (message: string) => push(message, "success"),
      error: (message: string) => push(message, "error"),
      info: (message: string) => push(message, "info"),
      /** Нейтральное уведомление (действие выполнено / фоновое). */
      action: (message: string) => push(message, "action"),
    }),
    [push],
  );
}

const variantClass: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-red-200 bg-red-50 text-red-950",
  info: "border-zinc-200 bg-white text-zinc-900",
  action: "border-zinc-200 bg-zinc-50 text-zinc-900",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback<PushFn>((message, variant = "info") => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now());
    setItems((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[200] flex max-w-md flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg transition-opacity duration-200 ${variantClass[t.variant]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
