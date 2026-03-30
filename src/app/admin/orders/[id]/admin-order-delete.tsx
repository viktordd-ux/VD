"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminDeleteModal } from "@/components/admin-delete-modal";
import { Button } from "@/components/ui/button";

export function AdminOrderDelete({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-red-200/90 bg-red-50/80 p-4 dark:border-red-900/55 dark:bg-red-950/45">
      <p className="text-sm font-medium text-red-900 dark:text-red-200">Опасная зона</p>
      <p className="mt-1 text-xs text-red-800/95 dark:text-red-300/95">
        Удаление заказа из списков и отчётов или полное удаление из базы.
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-3 border-red-300 bg-red-100/90 text-red-950 shadow-sm hover:bg-red-200/90 dark:border-red-500/45 dark:bg-red-950/60 dark:text-red-100 dark:hover:bg-red-900/55 dark:hover:shadow-[0_0_0_1px_rgba(248,113,113,0.25)]"
        onClick={() => setOpen(true)}
      >
        Удалить заказ…
      </Button>

      <AdminDeleteModal
        open={open}
        onClose={() => setOpen(false)}
        title="Удалить заказ"
        softHint="Заказ скроется из списков и отчётов; данные останутся в базе."
        hardHint="Заказ, файлы и этапы будут удалены из базы без восстановления."
        onSoft={async () => {
          const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
          if (!res.ok) throw new Error();
          router.push("/admin/orders");
        }}
        onHard={async () => {
          const res = await fetch(`/api/orders/${orderId}?hard=true`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error();
          router.push("/admin/orders");
        }}
      />
    </div>
  );
}
