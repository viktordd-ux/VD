"use client";

import type { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppToast } from "@/components/toast-provider";

export function ExecutorOrderPanel({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const router = useRouter();
  const toast = useAppToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status !== "IN_PROGRESS") return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEW" }),
    });
    setLoading(false);
    if (!res.ok) {
      toast("Не удалось сдать работу", "error");
      return;
    }
    toast("Работа сдана на проверку (REVIEW).", "success");
    router.refresh();
  }

  async function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setUploading(true);
    const res = await fetch(`/api/orders/${orderId}/files`, {
      method: "POST",
      body: fd,
    });
    setUploading(false);
    if (!res.ok) {
      toast("Ошибка загрузки", "error");
      return;
    }
    e.currentTarget.reset();
    toast("Файл загружен.", "success");
    router.refresh();
  }

  return (
    <div className="relative space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">Загрузить файл</h2>
        <form onSubmit={onUpload} className="mt-4 space-y-3">
          <input type="file" name="file" required className="block w-full text-sm" />
          <input
            name="comment"
            placeholder="Комментарий"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {uploading ? "…" : "Загрузить"}
          </button>
        </form>
      </section>

      <form onSubmit={onSubmit} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-zinc-500">Сдать работу</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Переводит заказ в статус REVIEW (на проверку). Доступно только из IN PROGRESS.
        </p>
        <button
          type="submit"
          disabled={loading || status !== "IN_PROGRESS"}
          className="mt-4 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "…" : "Сдать"}
        </button>
      </form>
    </div>
  );
}
