"use client";

import type { OrderStatus } from "@prisma/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AdminDeleteModal } from "@/components/admin-delete-modal";
import { useToast } from "@/components/toast-provider";
import { Button } from "@/components/ui/button";
import { useAdminOrdersListActions } from "@/context/admin-orders-list-actions";
import { parseCheckpointsFromListApi } from "@/lib/order-list-api-merge";
import { useState } from "react";

export function OrderRowQuickActions({
  orderId,
  status,
  checkpointCount,
}: {
  orderId: string;
  status: string;
  checkpointCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const list = useAdminOrdersListActions();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const assignMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${orderId}/auto-assign`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Ошибка");
      }
      return (await res.json()) as Record<string, unknown>;
    },
    onSuccess: (json) => {
      list?.patchOrderFromAdminApi(orderId, json);
      toast.success("Исполнитель назначен");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const completeCpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/orders/${orderId}/checkpoints/complete-all`,
        { method: "PATCH" },
      );
      if (!res.ok) throw new Error("complete");
      const data = (await res.json()) as {
        order?: { status?: string } | null;
      };
      const cpRes = await fetch(`/api/orders/${orderId}/checkpoints`);
      let checkpoints = null;
      if (cpRes.ok) {
        const raw = await cpRes.json();
        checkpoints = parseCheckpointsFromListApi(raw);
      }
      return { data, checkpoints };
    },
    onSuccess: ({ data, checkpoints }) => {
      if (checkpoints) {
        list?.setOrderCheckpoints(orderId, checkpoints);
      }
      if (data.order?.status) {
        list?.patchOrderStatus(orderId, data.order.status);
      }
      toast.success("Этапы завершены");
    },
    onError: () => {
      toast.error("Не удалось завершить этапы");
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEW" }),
      });
      if (!res.ok) throw new Error("review");
      return (await res.json()) as Record<string, unknown>;
    },
    onMutate: () => {
      const prev = status as OrderStatus;
      list?.patchOrderStatus(orderId, "REVIEW");
      return { prev };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prev) list?.patchOrderStatus(orderId, ctx.prev);
      toast.error("Не удалось перевести на проверку");
    },
    onSuccess: (json) => {
      list?.patchOrderFromAdminApi(orderId, json);
      toast.success("На проверке");
    },
  });

  const doneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (!res.ok) throw new Error("done");
      return (await res.json()) as Record<string, unknown>;
    },
    onMutate: () => {
      const prev = status as OrderStatus;
      list?.patchOrderStatus(orderId, "DONE");
      return { prev };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prev) list?.patchOrderStatus(orderId, ctx.prev);
      toast.error("Не удалось завершить заказ");
    },
    onSuccess: (json) => {
      list?.patchOrderFromAdminApi(orderId, json);
      toast.success("Заказ завершён");
    },
  });

  const busy =
    assignMutation.isPending ||
    completeCpMutation.isPending ||
    reviewMutation.isPending ||
    doneMutation.isPending;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full cursor-pointer sm:w-auto"
        disabled={busy}
        loading={assignMutation.isPending}
        title="Назначить лучшего исполнителя автоматически"
        onClick={() => assignMutation.mutate()}
      >
        Авто
      </Button>
      {checkpointCount > 0 && status === "IN_PROGRESS" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full cursor-pointer sm:w-auto"
          disabled={busy}
          loading={completeCpMutation.isPending}
          title="Завершить все этапы"
          onClick={() => completeCpMutation.mutate()}
        >
          Этапы
        </Button>
      )}
      {status !== "REVIEW" && status !== "DONE" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full cursor-pointer sm:w-auto"
          disabled={busy}
          loading={reviewMutation.isPending}
          onClick={() => reviewMutation.mutate()}
        >
          На проверку
        </Button>
      )}
      {status !== "DONE" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 sm:w-auto"
          disabled={busy}
          loading={doneMutation.isPending}
          onClick={() => doneMutation.mutate()}
        >
          Завершить
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full cursor-pointer border-red-200 text-red-800 hover:bg-red-50 sm:w-auto"
        disabled={busy}
        onClick={() => setDeleteOpen(true)}
      >
        Удалить
      </Button>

      <AdminDeleteModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Удалить заказ"
        softHint="Заказ скроется из списков и отчётов; данные останутся в базе."
        hardHint="Заказ, файлы и этапы будут удалены из базы без восстановления."
        onSoft={async () => {
          const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          list?.removeOrder(orderId);
          toast.action("Заказ скрыт");
          router.push("/admin/orders");
        }}
        onHard={async () => {
          const res = await fetch(`/api/orders/${orderId}?hard=true`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error();
          list?.removeOrder(orderId);
          toast.action("Заказ удалён");
          router.push("/admin/orders");
        }}
      />
    </div>
  );
}
