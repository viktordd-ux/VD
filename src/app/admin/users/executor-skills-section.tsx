"use client";

import type { User } from "@prisma/client";
import { useEffect, useState } from "react";
import { ExecutorSkillsEditor } from "./ui";

export function ExecutorSkillsSection({ user: initialUser }: { user: User }) {
  const [user, setUser] = useState(initialUser);
  useEffect(() => setUser(initialUser), [initialUser.id]);

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {user.primarySkill ? (
          <span className="inline-flex rounded-full bg-[var(--text)] px-3 py-1 text-sm font-semibold text-[var(--bg)] ring-1 ring-[color:var(--border)]">
            {user.primarySkill} — основной
          </span>
        ) : null}
        {user.skills
          .filter((s) => s !== user.primarySkill)
          .map((s) => (
            <span
              key={s}
              className="inline-flex rounded-full bg-[color:var(--muted-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--text)] ring-1 ring-[color:var(--border)]"
            >
              {s}
            </span>
          ))}
      </div>
      <div className="mt-6 rounded-xl border border-[color:var(--border)] bg-[var(--bg)] p-4">
        <p className="text-sm font-medium text-[var(--text)]">Изменить список навыков</p>
        <div className="mt-2">
          <ExecutorSkillsEditor
            user={user}
            embedded
            onSaved={(data) => {
              setUser((prev) => ({ ...prev, ...(data as Partial<User>) } as User));
            }}
          />
        </div>
      </div>
    </>
  );
}
