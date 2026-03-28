"use client";

import { OrderFileUpload } from "@/components/order-file-upload";
import { useExecutorOrder } from "@/components/executor-order/executor-order-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/components/toast-provider";
import { parseExecutorOrderFromApiJson, parseFileFromApiJson } from "@/lib/order-client-deserialize";
import { useState } from "react";

export function ExecutorOrderPanel({ orderId }: { orderId: string }) {
  const { order, setOrder, setFiles, bumpHistory } = useExecutorOrder();
  const toast = useAppToast();
  const [loading, setLoading] = useState(false);

  function onFileUploaded(fileJson: Record<string, unknown>) {
    const f = parseFileFromApiJson(fileJson);
    setFiles((prev) => [f, ...prev]);
    bumpHistory();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (order.status !== "IN_PROGRESS") return;
    setLoading(true);
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REVIEW" }),
      cache: "no-store",
    });
    setLoading(false);
    if (!res.ok) {
      toast("Не удалось сдать работу", "error");
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    setOrder((prev) => parseExecutorOrderFromApiJson(data, prev));
    toast("Работа сдана на проверку.", "success");
    bumpHistory();
  }

  return (
    <div className="relative space-y-6 pb-24 lg:pb-0">
      <Card className="p-4 md:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Файлы и ссылки
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Загрузите файл или добавьте ссылку на материал (Google Drive, Figma и т.д.).
        </p>
        <OrderFileUpload orderId={orderId} onUploaded={onFileUploaded} />
      </Card>

      <Card className="hidden p-4 md:block md:p-6">
        <form id="executor-submit-form" onSubmit={onSubmit}>
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
            disabled={loading || order.status !== "IN_PROGRESS"}
            className="mt-4 bg-emerald-700 hover:bg-emerald-800 disabled:cursor-not-allowed"
          >
            {loading ? "…" : "Сдать на проверку"}
          </Button>
        </form>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <p className="mb-2 text-center text-xs text-zinc-500">
          Статус «В работе» — можно сдать на проверку
        </p>
        <button
          type="submit"
          form="executor-submit-form"
          disabled={loading || order.status !== "IN_PROGRESS"}
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "…" : "Сдать на проверку"}
        </button>
      </div>
    </div>
  );
}
