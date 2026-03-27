"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type TemplateOpt = { id: string; title: string };

function QuickForm({ templates }: { templates: TemplateOpt[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [orderText, setOrderText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = sp.get("template");
    if (t) setTemplateId(t);
  }, [sp]);

  async function submit() {
    setLoading(true);
    const res = await fetch("/api/orders/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderText,
        templateId: templateId || null,
        autoAssign: true,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Ошибка");
      return;
    }
    const data = (await res.json()) as { id: string };
    router.push(`/admin/orders/${data.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/admin/orders" className="text-sm text-zinc-500 hover:text-zinc-800">
        ← К заказам
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">One Click</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Создать заказ из текста, применить шаблон этапов и сразу назначить лучшего исполнителя.
        </p>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label className="text-xs font-medium text-zinc-600">Текст заказа</label>
        <textarea
          value={orderText}
          onChange={(e) => setOrderText(e.target.value)}
          rows={10}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Первая строка — название, далее — ТЗ"
        />
        <label className="mt-4 block text-xs font-medium text-zinc-600">Шаблон</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">— без шаблона (только текст и авто-назначение) —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={loading || !orderText.trim()}
          onClick={submit}
          className="mt-6 w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "…" : "Создать и назначить"}
        </button>
      </div>
    </div>
  );
}

export function QuickClient({ templates }: { templates: TemplateOpt[] }) {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Загрузка…</div>}>
      <QuickForm templates={templates} />
    </Suspense>
  );
}
