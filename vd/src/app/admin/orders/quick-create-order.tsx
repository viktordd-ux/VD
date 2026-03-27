"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TemplateOpt = { id: string; title: string };

export function QuickCreateOrderButton({ templates }: { templates: TemplateOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderText, setOrderText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const res = await fetch("/api/orders/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderText,
        templateId: templateId || null,
        autoAssign: false,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Ошибка создания");
      return;
    }
    const data = (await res.json()) as { id: string };
    setOpen(false);
    setOrderText("");
    setTemplateId("");
    router.push(`/admin/orders/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Быстро создать заказ
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Быстрое создание заказа</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Первая строка — название, далее — ТЗ. При выборе шаблона подставится ТЗ шаблона и этапы.
            </p>
            <label className="mt-4 block text-xs font-medium text-zinc-600">Текст заказа</label>
            <textarea
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Название заказа&#10;Подробное ТЗ..."
            />
            <label className="mt-4 block text-xs font-medium text-zinc-600">Шаблон (необязательно)</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">— без шаблона —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={loading || !orderText.trim()}
                onClick={submit}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? "…" : "Создать"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
