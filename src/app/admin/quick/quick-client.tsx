"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type TemplateOpt = { id: string; title: string };

const fieldClass =
  "mt-1 w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] shadow-sm placeholder:text-[var(--muted)]";

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
      <Link
        href="/admin/orders"
        className="text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        ← К заказам
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Быстро создать заказ
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Создайте заказ из текста, подставьте шаблон этапов и сразу назначьте подходящего
          исполнителя.
        </p>
      </div>
      <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-6 shadow-sm shadow-black/[0.04] dark:shadow-black/30">
        <label className="text-xs font-medium text-[var(--muted)]">Текст заказа</label>
        <textarea
          value={orderText}
          onChange={(e) => setOrderText(e.target.value)}
          rows={10}
          className={fieldClass}
          placeholder="Первая строка — название, далее — ТЗ"
        />
        <label className="mt-4 block text-xs font-medium text-[var(--muted)]">Шаблон</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className={fieldClass}
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
          className="mt-6 w-full rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "…" : "Создать и назначить"}
        </button>
      </div>
    </div>
  );
}

export function QuickClient({ templates }: { templates: TemplateOpt[] }) {
  return (
    <Suspense fallback={<div className="text-sm text-[var(--muted)]">Загрузка…</div>}>
      <QuickForm templates={templates} />
    </Suspense>
  );
}
