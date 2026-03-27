"use client";

import type { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    toast("Работа сдана на проверку.", "success");
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
      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Загрузить файл
        </h2>
        <form onSubmit={onUpload} className="mt-4 space-y-3">
          <input type="file" name="file" required className="block w-full text-sm" />
          <input
            name="comment"
            placeholder="Комментарий (необязательно)"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
          <Button type="submit" variant="primary" size="md" disabled={uploading}>
            {uploading ? "…" : "Загрузить"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <form onSubmit={onSubmit}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Сдать работу
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Переводит заказ на проверку. Доступно только в статусе «В работе».
          </p>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading || status !== "IN_PROGRESS"}
            className="mt-4 bg-emerald-700 hover:bg-emerald-800 disabled:cursor-not-allowed"
          >
            {loading ? "…" : "Сдать на проверку"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
