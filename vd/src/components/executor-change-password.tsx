"use client";

import { useState } from "react";

export function ExecutorChangePassword() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get("currentPassword"));
    const newPassword = String(fd.get("newPassword"));
    const confirm = String(fd.get("confirmPassword"));

    if (newPassword !== confirm) {
      setMsg("Новый пароль и подтверждение не совпадают");
      return;
    }
    if (newPassword.length < 8) {
      setMsg("Новый пароль — не короче 8 символов");
      return;
    }

    setMsg(null);
    setBusy(true);
    const res = await fetch("/api/users/me/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setBusy(false);

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(err.error ?? "Ошибка");
      return;
    }
    e.currentTarget.reset();
    setMsg("Пароль обновлён.");
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold uppercase text-zinc-500">
        Сменить пароль
      </h2>
      <form onSubmit={onSubmit} className="mt-4 max-w-md space-y-3">
        <div>
          <label className="text-xs text-zinc-500">Текущий пароль</label>
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Новый пароль</label>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Повтор нового пароля</label>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        {msg && (
          <p
            className={`text-sm ${msg.includes("обновлён") ? "text-emerald-700" : "text-red-600"}`}
          >
            {msg}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {busy ? "…" : "Сохранить пароль"}
        </button>
      </form>
    </section>
  );
}
