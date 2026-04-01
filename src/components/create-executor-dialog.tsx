"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CredentialsModal } from "@/components/credentials-modal";
import { queryKeys } from "@/lib/query-keys";

const MEMBERSHIP_ROLES: { value: string; label: string }[] = [
  { value: "OWNER", label: "Владелец" },
  { value: "ADMIN", label: "Админ" },
  { value: "MANAGER", label: "Менеджер" },
  { value: "EXECUTOR", label: "Исполнитель" },
  { value: "VIEWER", label: "Наблюдатель" },
];

export function CreateExecutorDialog({
  onCreated,
}: {
  /** После успешного создания (доп. локальный callback). */
  onCreated?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("EXECUTOR");
  const [modal, setModal] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name")).trim();
    const email = String(fd.get("email")).trim();
    const skillsRaw = String(fd.get("skills") ?? "");
    const skills = skillsRaw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!name || !email) return;

    setBusy(true);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        role,
        ...(role === "EXECUTOR" ? { skills } : {}),
      }),
    });
    setBusy(false);

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      alert(err.error ?? "Не удалось создать");
      return;
    }

    const data = (await res.json()) as {
      email: string;
      generated_password: string;
    };
    setOpen(false);
    e.currentTarget.reset();
    setModal({ email: data.email, password: data.generated_password });
    onCreated?.();
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminOrdersCatalog() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.navBadges() });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 sm:w-auto sm:py-2"
      >
        Создать пользователя
      </button>

      {open && (
        <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-[color:var(--border)] bg-[var(--card)] p-5 shadow-xl shadow-black/10 dark:shadow-black/50 sm:rounded-xl sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--text)]">Новый пользователь</h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--muted)]">Имя</label>
                <input
                  name="name"
                  required
                  className="mt-1 w-full min-h-11 rounded-md border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--muted)] sm:min-h-0 sm:py-2 sm:text-sm"
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--muted)]">Эл. почта (логин)</label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 w-full min-h-11 rounded-md border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--muted)] sm:min-h-0 sm:py-2 sm:text-sm"
                  placeholder="name@студия.ru"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--muted)]">Роль в организации</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 w-full min-h-11 rounded-md border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] sm:min-h-0 sm:py-2 sm:text-sm"
                >
                  {MEMBERSHIP_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {role === "EXECUTOR" ? (
                <div>
                  <label className="text-sm font-medium text-[var(--muted)]">
                    Навыки (теги через запятую)
                  </label>
                  <input
                    name="skills"
                    className="mt-1 w-full min-h-11 rounded-md border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--muted)] sm:min-h-0 sm:py-2 sm:text-sm"
                    placeholder="react, figma"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  className="min-h-11 w-full rounded-md bg-[var(--text)] px-4 py-2.5 text-sm font-medium text-[var(--bg)] transition-all duration-[140ms] ease-out hover:scale-[1.01] hover:opacity-90 active:scale-[0.98] sm:w-auto sm:py-2"
                >
                  {busy ? "…" : "Создать"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-11 w-full rounded-md border border-[color:var(--border)] bg-transparent px-4 py-2.5 text-sm text-[var(--text)] transition hover:bg-[color:var(--muted-bg)] sm:w-auto sm:py-2"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <CredentialsModal
        open={modal !== null}
        title="Исполнитель создан"
        email={modal?.email ?? ""}
        password={modal?.password ?? ""}
        onClose={() => setModal(null)}
      />
    </>
  );
}
