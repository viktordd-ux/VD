"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminDeleteModal } from "@/components/admin-delete-modal";
import { Button } from "@/components/ui/button";

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
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy !== null}
        title="Назначить лучшего исполнителя автоматически"
        onClick={() =>
          run("assign", async () => {
            const res = await fetch(`/api/orders/${orderId}/auto-assign`, {
              method: "POST",
            });
            if (!res.ok) {
              alert((await res.json().catch(() => ({}))).error ?? "Ошибка");
            }
          })
        }
      >
        {busy === "assign" ? "…" : "Авто"}
      </Button>
      {checkpointCount > 0 && status === "IN_PROGRESS" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          title="Завершить все этапы"
          onClick={() =>
            run("cp", async () => {
              const res = await fetch(
                `/api/orders/${orderId}/checkpoints/complete-all`,
                { method: "PATCH" },
              );
              if (!res.ok) alert("Не удалось завершить этапы");
            })
          }
        >
          {busy === "cp" ? "…" : "Этапы"}
        </Button>
      )}
      {status !== "REVIEW" && status !== "DONE" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            run("review", async () => {
              const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "REVIEW" }),
              });
              if (!res.ok) alert("Не удалось перевести на проверку");
            })
          }
        >
          {busy === "review" ? "…" : "На проверку"}
        </Button>
      )}
      {status !== "DONE" && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          disabled={busy !== null}
          onClick={() =>
            run("done", async () => {
              const res = await fetch(`/api/orders/${orderId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "DONE" }),
              });
              if (!res.ok) alert("Не удалось завершить заказ");
            })
          }
        >
          {busy === "done" ? "…" : "Завершить"}
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="border-red-200 text-red-800 hover:bg-red-50"
        disabled={busy !== null}
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
          router.push("/admin/orders");
          router.refresh();
        }}
        onHard={async () => {
          const res = await fetch(`/api/orders/${orderId}?hard=true`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error();
          router.push("/admin/orders");
          router.refresh();
        }}
      />
    </div>
  );
}
