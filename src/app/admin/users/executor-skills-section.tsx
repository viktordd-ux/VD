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
          <span className="inline-flex rounded-full bg-zinc-900 px-3 py-1 text-sm font-semibold text-white ring-1 ring-zinc-900">
            {user.primarySkill} — основной
          </span>
        ) : null}
        {user.skills
          .filter((s) => s !== user.primarySkill)
          .map((s) => (
            <span
              key={s}
              className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200"
            >
              {s}
            </span>
          ))}
      </div>
      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm font-medium text-zinc-800">Изменить список навыков</p>
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
