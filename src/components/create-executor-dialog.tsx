"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CredentialsModal } from "@/components/credentials-modal";

export function CreateExecutorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
      body: JSON.stringify({ name, email, skills }),
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
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Создать исполнителя
      </button>

      {open && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Новый исполнитель</h2>
            <form onSubmit={onSubmit} className="mt-4 space-y-4">
              <div>
                <label className="text-xs text-zinc-500">Имя</label>
                <input
                  name="name"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="Иван Иванов"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Эл. почта (логин)</label>
                <input
                  name="email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="name@студия.ru"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">
                  Навыки (теги через запятую)
                </label>
                <input
                  name="skills"
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  placeholder="react, figma"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                >
                  {busy ? "…" : "Создать"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
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
