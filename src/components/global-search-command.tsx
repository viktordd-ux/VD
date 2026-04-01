"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { queryKeys } from "@/lib/query-keys";
import { STALE_MS } from "@/lib/query-stale";
import { cn } from "@/lib/cn";

type SearchPayload = {
  orders: { id: string; title: string; clientName: string; status: string }[];
  executors: { id: string; name: string; email: string }[];
  leads: { id: string; clientName: string; platform: string; status: string }[];
};

async function fetchSearch(q: string): Promise<SearchPayload> {
  const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("search");
  return res.json() as Promise<SearchPayload>;
}

type Row =
  | { type: "order"; id: string; title: string; subtitle: string; href: string }
  | { type: "executor"; id: string; title: string; subtitle: string; href: string }
  | { type: "lead"; id: string; title: string; subtitle: string; href: string };

export function GlobalSearchCommand({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 200);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.globalSearch(debounced),
    queryFn: () => fetchSearch(debounced),
    enabled: open && debounced.length >= 2,
    staleTime: STALE_MS.search,
  });

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const o: Row[] = data.orders.map((x) => ({
      type: "order" as const,
      id: x.id,
      title: x.title,
      subtitle: `${x.clientName} · ${x.status}`,
      href: `/admin/orders/${x.id}`,
    }));
    const e: Row[] = data.executors.map((x) => ({
      type: "executor" as const,
      id: x.id,
      title: x.name,
      subtitle: x.email,
      href: `/admin/users?q=${encodeURIComponent(x.email)}`,
    }));
    const l: Row[] = data.leads.map((x) => ({
      type: "lead" as const,
      id: x.id,
      title: x.clientName,
      subtitle: `${x.platform} · ${x.status}`,
      href: `/admin/leads`,
    }));
    return [...o, ...e, ...l];
  }, [data]);

  useEffect(() => {
    setSelected(0);
  }, [debounced, data]);

  useEffect(() => {
    if (open) {
      setQ("");
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const go = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && rows[selected]) {
        e.preventDefault();
        go(rows[selected].href);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, rows, selected, go, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 p-4 pt-[min(8rem,15vh)] backdrop-blur-sm vd-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Поиск"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-950/20"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-3 py-2">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск заказов, исполнителей, лидов…"
            className="w-full border-0 bg-transparent px-2 py-2 text-base text-zinc-900 outline-none placeholder:text-zinc-400"
            autoComplete="off"
          />
        </div>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-1">
          {debounced.length < 2 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">
              Введите минимум 2 символа
            </p>
          ) : isFetching && !data ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">Поиск…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">Ничего не найдено</p>
          ) : (
            <ul className="space-y-0.5">
              {rows.map((r, i) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => go(r.href)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150 ease-out",
                      i === selected
                        ? "bg-zinc-100/90"
                        : "hover:bg-zinc-50 active:scale-[0.99]",
                    )}
                  >
                    <span className="text-sm font-medium text-zinc-900">{r.title}</span>
                    <span className="text-xs text-zinc-500">
                      {r.type === "order" && "Заказ · "}
                      {r.type === "executor" && "Исполнитель · "}
                      {r.type === "lead" && "Лид · "}
                      {r.subtitle}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-400">
          ↑↓ выбор · Enter открыть · Esc закрыть
        </p>
      </div>
    </div>
  );
}
