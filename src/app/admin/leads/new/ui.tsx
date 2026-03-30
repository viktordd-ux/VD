"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewLeadForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      link: String(fd.get("link")),
      clientName: String(fd.get("clientName")),
      platform: String(fd.get("platform")),
      text: String(fd.get("text")),
      notes: fd.get("notes") ? String(fd.get("notes")) : undefined,
      status: "NEW",
    };
    setLoading(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      alert("Ошибка создания");
      return;
    }
    router.push("/admin/leads");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <label className="text-xs font-medium text-zinc-600">Ссылка</label>
        <input name="link" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">Клиент</label>
        <input name="clientName" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">Платформа</label>
        <input name="platform" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">Текст заказа</label>
        <textarea name="text" required rows={5} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">Заметки</label>
        <textarea name="notes" rows={3} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading ? "…" : "Создать"}
      </button>
    </form>
  );
}
