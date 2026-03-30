"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminHardDeleteOnlyModal } from "@/components/admin-delete-modal";
import { Button } from "@/components/ui/button";

export function AdminDeleteExecutor({
  userId,
  displayName,
}: {
  userId: string;
  displayName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="md"
        className="w-full sm:w-auto"
        onClick={() => setOpen(true)}
      >
        Удалить навсегда
      </Button>
      <AdminHardDeleteOnlyModal
        open={open}
        onClose={() => setOpen(false)}
        title="Удалить исполнителя безвозвратно"
        hint={`Будет удалена учётная запись «${displayName}». Вход по email и паролю станет невозможен. Заказы останутся в системе без назначенного исполнителя. Это действие необратимо.`}
        onConfirm={async () => {
          const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? "Не удалось удалить");
          }
          router.push("/admin/users");
        }}
      />
    </>
  );
}
