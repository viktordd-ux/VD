"use client";

import type { User } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CredentialsModal } from "@/components/credentials-modal";
import { Badge } from "@/components/ui/badge";
import { formatUserDisplayName } from "@/lib/user-profile";
import { userStatusLabel } from "@/lib/ui-labels";

export function ExecutorSkillsEditor({
  user,
  score,
  embedded,
  onSaved,
}: {
  user: User;
  score?: number;
  /** Только форма навыков (для страницы карточки) */
  embedded?: boolean;
  /** После успешного PATCH — обновить локальную модель без router.refresh */
  onSaved?: (patch: Record<string, unknown>) => void;
}) {
  const [tags, setTags] = useState(user.skills.join(", "));
  const [saving, setSaving] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  useEffect(() => {
    setTags(user.skills.join(", "));
  }, [user.id, user.skills.join(",")]);

  async function save() {
    const skills = tags
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const prevTags = user.skills.join(", ");
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills }),
    });
    setSaving(false);
    if (!res.ok) {
      setTags(prevTags);
      alert("Не удалось сохранить");
      return;
    }
    const data = (await res.json()) as Record<string, unknown>;
    onSaved?.(data);
  }

  async function resetPassword() {
    if (!confirm(`Сбросить пароль для ${user.email}?`)) return;
    setResetBusy(true);
    const res = await fetch(`/api/users/${user.id}/reset-password`, {
      method: "POST",
    });
    setResetBusy(false);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      alert(err.error ?? "Ошибка сброса");
      return;
    }
    const data = (await res.json()) as {
      email: string;
      generated_password: string;
    };
    setCredentials({
      email: data.email,
      password: data.generated_password,
    });
  }

  const form = (
    <div className={embedded ? "w-full max-w-lg" : "min-w-[240px] flex-1 max-w-lg"}>
      <label className="text-xs text-[var(--muted)]">Навыки (теги через запятую)</label>
      <input
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)]"
        placeholder="react, figma, тильда"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-2 rounded-md bg-[var(--text)] px-3 py-1.5 text-xs font-medium text-[var(--bg)] transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "…" : "Сохранить навыки"}
      </button>
      <button
        type="button"
        onClick={() => void resetPassword()}
        disabled={resetBusy}
        className="ml-2 mt-2 rounded-md border border-[color:var(--border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-[color:var(--muted-bg)] disabled:opacity-50"
      >
        {resetBusy ? "…" : "Сбросить пароль"}
      </button>
    </div>
  );

  if (embedded) {
    return (
      <>
        <CredentialsModal
          open={credentials !== null}
          title="Новый пароль"
          email={credentials?.email ?? ""}
          password={credentials?.password ?? ""}
          onClose={() => setCredentials(null)}
        />
        {form}
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--card)] p-5 shadow-sm shadow-black/[0.04] dark:shadow-black/40">
      <CredentialsModal
        open={credentials !== null}
        title="Новый пароль"
        email={credentials?.email ?? ""}
        password={credentials?.password ?? ""}
        onClose={() => setCredentials(null)}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            <Link
              href={`/admin/users/${user.id}`}
              className="text-[var(--text)] underline-offset-2 hover:underline"
            >
              {formatUserDisplayName(user)}
            </Link>
          </p>
          <p className="text-sm text-[var(--muted)]">{user.email}</p>
          <p className="mt-1">
            <Badge tone={user.status === "active" ? "success" : "danger"}>
              {userStatusLabel[user.status]}
            </Badge>
          </p>
          {score !== undefined && (
            <p className="mt-2 text-sm font-semibold tabular-nums text-[var(--text)]">
              Рейтинг подбора: {score}
            </p>
          )}
        </div>
        {form}
      </div>
    </div>
  );
}
