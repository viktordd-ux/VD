"use client";

import { useState } from "react";

export function AdminUserStatusToggle({
  userId,
  currentStatus,
  onSuccess,
}: {
  userId: string;
  currentStatus: "active" | "banned";
  onSuccess?: (next: "active" | "banned") => void;
}) {
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
    onSuccess?.(newStatus);
  }

  const isBanned = currentStatus === "banned";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        isBanned
          ? "bg-[var(--text)] text-[var(--bg)] hover:opacity-90"
          : "border border-[color:var(--border)] bg-transparent text-[var(--text)] hover:bg-[color:var(--muted-bg)]"
      }`}
    >
      {busy ? "…" : isBanned ? "Разблокировать" : "Заблокировать"}
    </button>
  );
}
