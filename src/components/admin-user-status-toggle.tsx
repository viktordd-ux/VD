"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminUserStatusToggle({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: "active" | "banned";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const newStatus = currentStatus === "active" ? "banned" : "active";
    const label = newStatus === "banned" ? "заблокировать" : "разблокировать";
    if (!confirm(`Вы уверены, что хотите ${label} этого пользователя?`)) return;

    setBusy(true);
    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(false);

    if (!res.ok) {
      alert("Не удалось обновить статус");
      return;
    }
    router.refresh();
  }

  const isBanned = currentStatus === "banned";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        isBanned
          ? "bg-emerald-700 text-white hover:bg-emerald-800"
          : "bg-red-600 text-white hover:bg-red-700"
      }`}
    >
      {busy ? "…" : isBanned ? "Разблокировать" : "Заблокировать"}
    </button>
  );
}
