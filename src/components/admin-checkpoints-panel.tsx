"use client";

import type { Checkpoint } from "@prisma/client";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkpointStatusLabel } from "@/lib/ui-labels";

function dueInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 16);
}

function SortableRow({
  c,
  busy,
  onSave,
  onRemove,
}: {
  c: Checkpoint;
  busy: string | null;
  onSave: (
    id: string,
    patch: Partial<{
      title: string;
      dueDate: string | null;
      status: "pending" | "awaiting_approval" | "done";
      paymentAmount: number;
    }>,
  ) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: c.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <button
          type="button"
          className="touch-none cursor-grab select-none rounded px-1 text-zinc-400 active:cursor-grabbing"
          title="Перетащить"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <input
          defaultValue={c.title}
          className="w-full min-w-0 rounded border border-zinc-200 bg-white px-2 py-1 text-sm font-medium sm:max-w-xs"
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== c.title) void onSave(c.id, { title: v });
          }}
        />
        <input
          type="datetime-local"
          defaultValue={dueInputValue(c.dueDate)}
          className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
          onBlur={(e) => {
            const v = e.target.value;
            const prevIso = c.dueDate
              ? (typeof c.dueDate === "string"
                  ? new Date(c.dueDate)
                  : c.dueDate
                ).toISOString()
              : null;
            const nextIso = v ? new Date(v).toISOString() : null;
            if (nextIso !== prevIso) void onSave(c.id, { dueDate: v || null });
          }}
        />
        <input
          type="number"
          min={0}
          step={0.01}
          title="Выплата исполнителю за этап (₽)"
          defaultValue={Number(c.paymentAmount)}
          className="w-[88px] rounded border border-zinc-200 bg-white px-2 py-1 text-xs tabular-nums"
          onBlur={(e) => {
            const v = Number(e.target.value);
            if (!Number.isFinite(v) || v < 0) return;
            if (v !== Number(c.paymentAmount)) void onSave(c.id, { paymentAmount: v });
          }}
        />
        <select
          defaultValue={c.status}
          disabled={busy === c.id}
          onChange={(e) => {
            const status = e.target.value as "pending" | "awaiting_approval" | "done";
            void onSave(c.id, { status });
          }}
          className="w-fit rounded border border-zinc-200 bg-white px-2 py-1 text-sm"
        >
          <option value="pending">{checkpointStatusLabel.pending}</option>
          <option value="awaiting_approval">{checkpointStatusLabel.awaiting_approval}</option>
          <option value="done">{checkpointStatusLabel.done}</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => onRemove(c.id)}
        disabled={busy === c.id}
        className="text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        Удалить
      </button>
    </li>
  );
}

export function AdminCheckpointsPanel({
  orderId,
  initial,
}: {
  orderId: string;
  initial: Checkpoint[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  async function refresh() {
    const res = await fetch(`/api/orders/${orderId}/checkpoints`);
    if (res.ok) {
      const data = (await res.json()) as Checkpoint[];
      setItems(data);
    }
    router.refresh();
  }

  async function persistReorder(orderedIds: string[]) {
    const res = await fetch(`/api/orders/${orderId}/checkpoints/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      alert("Не удалось сохранить порядок этапов");
      await refresh();
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    void persistReorder(next.map((c) => c.id));
  }

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title"));
    const due = fd.get("dueDate") ? String(fd.get("dueDate")) : null;
    setBusy("new");
    const res = await fetch(`/api/orders/${orderId}/checkpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        dueDate: due,
        status: "pending",
      }),
    });
    setBusy(null);
    if (!res.ok) {
      alert("Не удалось добавить");
      return;
    }
    e.currentTarget.reset();
    await refresh();
  }

  async function saveRow(
    id: string,
    patch: Partial<{
      title: string;
      dueDate: string | null;
      status: "pending" | "awaiting_approval" | "done";
      paymentAmount: number;
    }>,
  ) {
    setBusy(id);
    const res = await fetch(`/api/checkpoints/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setBusy(null);
    if (!res.ok) {
      alert("Ошибка сохранения");
      return;
    }
    await refresh();
  }

  async function remove(id: string) {
    if (!confirm("Удалить этот этап?")) return;
    setBusy(id);
    const res = await fetch(`/api/checkpoints/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      alert("Ошибка удаления");
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">
        Перетаскивание за ⋮⋮ (мышь и сенсор). Дедлайн — дата и время. Укажите сумму выплаты в поле «₽» —
        её меняете только вы; исполнитель сдаёт этап на проверку, после принятия этапа выплата
        фиксируется в его «Заработке».
      </p>
      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-2 border-b border-zinc-100 pb-4"
      >
        <div className="min-w-[160px] flex-1">
          <label className="text-xs text-zinc-500">Новый этап</label>
          <input
            name="title"
            required
            placeholder="Название"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500">Дедлайн</label>
          <input
            type="datetime-local"
            name="dueDate"
            className="mt-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy === "new"}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {busy === "new" ? "…" : "Добавить"}
        </button>
      </form>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-3">
            {items.map((c) => (
              <SortableRow
                key={c.id}
                c={c}
                busy={busy}
                onSave={saveRow}
                onRemove={remove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <p className="text-sm text-zinc-500">Этапов пока нет — добавьте первый ниже.</p>
      )}
    </div>
  );
}
