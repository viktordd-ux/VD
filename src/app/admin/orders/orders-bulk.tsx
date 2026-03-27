"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AdminHardDeleteOnlyModal } from "@/components/admin-delete-modal";

const Ctx = createContext<{
  selected: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
} | null>(null);

export function OrdersBulkProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return <Ctx.Provider value={{ selected, toggle, clear }}>{children}</Ctx.Provider>;
}

export function useOrdersBulk() {
  const v = useContext(Ctx);
  if (!v) throw new Error("OrdersBulkProvider required");
  return v;
}

export function OrdersBulkCheckbox({ orderId }: { orderId: string }) {
  const { selected, toggle } = useOrdersBulk();
  return (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-zinc-300"
      checked={selected.has(orderId)}
      onChange={() => toggle(orderId)}
      aria-label="Выбрать заказ"
    />
  );
}

export function OrdersBulkToolbar() {
  const { selected, clear } = useOrdersBulk();
  const router = useRouter();
  const [hardOpen, setHardOpen] = useState(false);

  const n = selected.size;
  if (n === 0) return null;

  async function bulk(soft: boolean) {
    const res = await fetch("/api/admin/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "orders",
        ids: [...selected],
        hard: !soft,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      failed?: { id: string; error: string }[];
      error?: string;
    };
    if (!res.ok) {
      alert(data.error ?? "Ошибка");
      return;
    }
    if (data.failed?.length) {
      alert(
        `Частично: ошибок ${data.failed.length}. Проверьте связи и повторите.`,
      );
    }
    clear();
    setHardOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="font-medium">Выбрано: {n}</span>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          <button
            type="button"
            onClick={() => {
              if (
                !window.confirm(
                  `Скрыть ${n} заказ(ов)? Данные останутся в БД, но исчезнут из списков и отчётов.`,
                )
              ) {
                return;
              }
              void bulk(true);
            }}
            className="min-h-11 w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto sm:py-1.5 sm:text-xs"
          >
            Удалить (скрыть)
          </button>
          <button
            type="button"
            onClick={() => setHardOpen(true)}
            className="min-h-11 w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-900 hover:bg-red-100 sm:w-auto sm:py-1.5 sm:text-xs"
          >
            Удалить навсегда…
          </button>
        </div>
        <button
          type="button"
          onClick={() => clear()}
          className="min-h-11 w-full text-sm text-zinc-600 underline sm:min-h-0 sm:w-auto sm:text-xs"
        >
          Снять выбор
        </button>
      </div>

      <AdminHardDeleteOnlyModal
        open={hardOpen}
        onClose={() => setHardOpen(false)}
        title="Удалить заказы безвозвратно"
        hint={`Будут удалены ${n} заказ(ов), файлы на диске и этапы. Это необратимо.`}
        onConfirm={async () => {
          await bulk(false);
        }}
      />
    </>
  );
}
