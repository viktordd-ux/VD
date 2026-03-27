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

export function LeadsBulkProvider({ children }: { children: React.ReactNode }) {
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

export function useLeadsBulk() {
  const v = useContext(Ctx);
  if (!v) throw new Error("LeadsBulkProvider required");
  return v;
}

export function LeadsBulkCheckbox({ leadId }: { leadId: string }) {
  const { selected, toggle } = useLeadsBulk();
  return (
    <input
      type="checkbox"
      className="h-4 w-4 rounded border-zinc-300"
      checked={selected.has(leadId)}
      onChange={() => toggle(leadId)}
      aria-label="Выбрать лид"
    />
  );
}

export function LeadsBulkToolbar() {
  const { selected, clear } = useLeadsBulk();
  const router = useRouter();
  const [hardOpen, setHardOpen] = useState(false);

  const n = selected.size;
  if (n === 0) return null;

  async function bulk(soft: boolean) {
    const res = await fetch("/api/admin/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "leads",
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
      alert(`Ошибок при обработке: ${data.failed.length}`);
    }
    clear();
    setHardOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <span className="font-medium">Лидов выбрано: {n}</span>
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                `Скрыть ${n} лид(ов)? Если у лида есть активные заказы, операция для него не выполнится.`,
              )
            ) {
              return;
            }
            void bulk(true);
          }}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Удалить (скрыть)
        </button>
        <button
          type="button"
          onClick={() => setHardOpen(true)}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900 hover:bg-red-100"
        >
          Удалить навсегда…
        </button>
        <button
          type="button"
          onClick={() => clear()}
          className="text-xs text-zinc-600 underline"
        >
          Снять выбор
        </button>
      </div>

      <AdminHardDeleteOnlyModal
        open={hardOpen}
        onClose={() => setHardOpen(false)}
        title="Удалить лиды безвозвратно"
        hint={`Будет выполнено полное удаление для ${n} записей; связи заказов с лидами будут сняты.`}
        onConfirm={async () => {
          await bulk(false);
        }}
      />
    </>
  );
}
