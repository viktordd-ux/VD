"use client";

import type { User } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CredentialsModal } from "@/components/credentials-modal";
import { Badge } from "@/components/ui/badge";
import { userStatusLabel } from "@/lib/ui-labels";

export function ExecutorSkillsEditor({
  user,
  score,
}: {
  user: User;
  score?: number;
}) {
  const router = useRouter();
  const [tags, setTags] = useState(user.skills.join(", "));
  const [saving, setSaving] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [credentials, setCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function save() {
    const skills = tags
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSaving(true);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Не удалось сохранить");
      return;
    }
    router.refresh();
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
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm shadow-zinc-950/[0.04]">
      <CredentialsModal
        open={credentials !== null}
        title="Новый пароль"
        email={credentials?.email ?? ""}
        password={credentials?.password ?? ""}
        onClose={() => setCredentials(null)}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-zinc-500">{user.email}</p>
          <p className="mt-1">
            <Badge tone={user.status === "active" ? "success" : "danger"}>
              {userStatusLabel[user.status]}
            </Badge>
          </p>
          {score !== undefined && (
            <p className="mt-2 text-sm font-semibold tabular-nums text-zinc-800">
              Рейтинг подбора: {score}
            </p>
          )}
        </div>
        <div className="min-w-[240px] flex-1 max-w-lg">
          <label className="text-xs text-zinc-500">Навыки (теги через запятую)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="react, figma, тильда"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "…" : "Сохранить навыки"}
          </button>
          <button
            type="button"
            onClick={() => void resetPassword()}
            disabled={resetBusy}
            className="ml-2 mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            {resetBusy ? "…" : "Сбросить пароль"}
          </button>
        </div>
      </div>
    </div>
  );
}
