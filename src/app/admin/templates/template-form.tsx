"use client";

import type { OrderTemplate } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseDefaultCheckpoints } from "@/lib/order-template";

type Row = { title: string; due_offset_days: string };

export function TemplateForm({ template }: { template?: OrderTemplate | null }) {
  const router = useRouter();
  const isEdit = Boolean(template?.id);
  const initialRows = (() => {
    if (!template) return [{ title: "", due_offset_days: "" }] as Row[];
    const items = parseDefaultCheckpoints(template.defaultCheckpoints);
    if (items.length === 0) return [{ title: "", due_offset_days: "" }];
    return items.map((i) => ({
      title: i.title,
      due_offset_days:
        typeof i.due_offset_days === "number" ? String(i.due_offset_days) : "",
    }));
  })();

  const [title, setTitle] = useState(template?.title ?? "");
  const [descriptionTemplate, setDescriptionTemplate] = useState(
    template?.descriptionTemplate ?? "",
  );
  const [tags, setTags] = useState(template?.tags.join(", ") ?? "");
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [saving, setSaving] = useState(false);

  function addRow() {
    setRows((r) => [...r, { title: "", due_offset_days: "" }]);
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, j) => j !== i));
  }

  async function save() {
    const defaultCheckpoints = rows
      .filter((row) => row.title.trim())
      .map((row) => {
        const d = row.due_offset_days.trim();
        let due_offset_days: number | null = null;
        if (d !== "" && !Number.isNaN(Number(d))) {
          due_offset_days = Math.max(0, Math.floor(Number(d)));
        }
        return { title: row.title.trim(), due_offset_days };
      });

    const tagList = tags
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    const url = isEdit ? `/api/order-templates/${template!.id}` : "/api/order-templates";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        descriptionTemplate,
        defaultCheckpoints,
        tags: tagList,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Ошибка сохранения");
      return;
    }
    router.push("/admin/templates");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <label className="text-xs font-medium text-zinc-600">Название шаблона</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">ТЗ по умолчанию (description)</label>
        <textarea
          value={descriptionTemplate}
          onChange={(e) => setDescriptionTemplate(e.target.value)}
          rows={8}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">
          Теги навыков (для подбора исполнителя)
        </label>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="design, frontend"
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-600">Этапы (чекпоинты)</label>
          <button
            type="button"
            onClick={addRow}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            + этап
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Срок: дней от даты создания заказа (пусто — без даты)
        </p>
        <div className="mt-2 space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <input
                value={row.title}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, title: v } : x)),
                  );
                }}
                placeholder="Название этапа"
                className="min-w-[200px] flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                value={row.due_offset_days}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((prev) =>
                    prev.map((x, j) => (j === i ? { ...x, due_offset_days: v } : x)),
                  );
                }}
                placeholder="дней"
                className="w-24 rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="rounded-md px-2 text-sm text-red-600 hover:bg-red-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving || !title.trim()}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
      >
        {saving ? "…" : isEdit ? "Сохранить" : "Создать шаблон"}
      </button>
    </div>
  );
}
