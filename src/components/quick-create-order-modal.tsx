"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useToast } from "@/components/toast-provider";

export function QuickCreateOrderModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [orderText, setOrderText] = useState("");
  const [templateId, setTemplateId] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["admin", "templates-mini"],
    queryFn: async () => {
      const res = await fetch("/api/admin/templates-mini");
      if (!res.ok) throw new Error("templates");
      const j = (await res.json()) as { templates: { id: string; title: string }[] };
      return j.templates;
    },
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) {
      setOrderText("");
      setTemplateId("");
    }
  }, [open]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/orders/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderText,
          templateId: templateId || null,
          autoAssign: false,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Ошибка создания");
      }
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => {
      onClose();
      onCreated?.();
      toast.success("Заказ создан");
      router.push(`/admin/orders/${data.id}`);
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-xl sm:rounded-xl sm:p-6">
        <h2 className="text-lg font-semibold">Быстрое создание заказа</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Первая строка — название, далее — ТЗ. При выборе шаблона подставится ТЗ шаблона и этапы.
        </p>
        <label className="mt-4 block text-sm font-medium text-zinc-700">Текст заказа</label>
        <textarea
          value={orderText}
          onChange={(e) => setOrderText(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2.5 text-base leading-relaxed"
          placeholder="Название заказа&#10;Подробное ТЗ..."
        />
        <label className="mt-4 block text-sm font-medium text-zinc-700">Шаблон (необязательно)</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="mt-1 w-full min-h-11 cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-base sm:min-h-0 sm:py-2 sm:text-sm"
        >
          <option value="">— без шаблона —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 w-full cursor-pointer rounded-md border border-zinc-200 px-4 py-2.5 text-sm text-zinc-700 transition-all duration-150 hover:bg-zinc-100 sm:w-auto"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={createMutation.isPending || !orderText.trim()}
            onClick={() => createMutation.mutate()}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-zinc-800 disabled:pointer-events-none disabled:opacity-50 sm:w-auto"
          >
            {createMutation.isPending ? (
              <>
                <span
                  className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-white/90"
                  aria-hidden
                />
                Создание…
              </>
            ) : (
              "Создать"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
