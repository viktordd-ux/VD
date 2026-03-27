"use client";

import type { OrderStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { OrderFileUpload } from "@/components/order-file-upload";
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

  return (
    <div className="relative space-y-6">
      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Файлы и ссылки
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Загрузите файл или добавьте ссылку на материал (Google Drive, Figma и т.д.).
        </p>
        <OrderFileUpload orderId={orderId} />
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
