"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  push: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useAppToast(): ToastContextValue["push"] {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return () => {};
  }
  return ctx.push;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((message: string, variant: ToastVariant = "info") => {
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
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.variant === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                : t.variant === "error"
                  ? "border-red-200 bg-red-50 text-red-950"
                  : "border-zinc-200 bg-white text-zinc-900"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
