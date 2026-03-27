"use client";

import type { Order, User, Lead } from "@prisma/client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminAutoAssignButton } from "@/components/admin-auto-assign";

type ExecutorOption = Pick<User, "id" | "name" | "email" | "skills">;

type OrderWith = Order & { executor: User | null; lead: Lead | null };

export function AdminOrderForm({
  order,
  executors,
  executorScores,
}: {
  order: OrderWith;
  executors: ExecutorOption[];
  executorScores: Record<string, number>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [skillTag, setSkillTag] = useState("");

  const filteredExecutors = useMemo(() => {
    const t = skillTag.trim().toLowerCase();
    if (!t) return executors;
    return executors.filter((u) =>
      u.skills.some((s) => s.toLowerCase().includes(t)),
    );
  }, [executors, skillTag]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const reqSkillsRaw = String(fd.get("requiredSkills") ?? "");
    const requiredSkills = reqSkillsRaw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body = {
      title: String(fd.get("title")),
      description: String(fd.get("description")),
      clientName: String(fd.get("clientName")),
      platform: String(fd.get("platform")),
      deadline: fd.get("deadline") ? String(fd.get("deadline")) : null,
      budgetClient: Number(fd.get("budgetClient")),
      budgetExecutor: Number(fd.get("budgetExecutor")),
      status: fd.get("status") as "LEAD" | "IN_PROGRESS" | "REVIEW" | "DONE",
      executorId: fd.get("executorId") ? String(fd.get("executorId")) : null,
      requiredSkills,
    };
    setLoading(true);
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      alert("Ошибка сохранения");
      return;
    }
    router.refresh();
  }

  const dl = order.deadline ? order.deadline.toISOString().slice(0, 16) : "";
  const marginPct =
    Number(order.budgetClient) > 0
      ? Math.round(
          (Number(order.profit) / Number(order.budgetClient)) * 100,
        )
      : null;

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-sm font-semibold uppercase text-zinc-500">Карточка заказа</h2>
      <div>
        <label className="text-xs font-medium text-zinc-600">Название</label>
        <input
          name="title"
          defaultValue={order.title}
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">ТЗ (description)</label>
        <textarea
          name="description"
          defaultValue={order.description}
          required
          rows={6}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-zinc-600">Клиент</label>
          <input
            name="clientName"
            defaultValue={order.clientName}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Платформа</label>
          <input
            name="platform"
            defaultValue={order.platform}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">Дедлайн</label>
        <input
          type="datetime-local"
          name="deadline"
          defaultValue={dl}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-zinc-600">Бюджет клиента</label>
          <input
            name="budgetClient"
            type="number"
            step="0.01"
            defaultValue={order.budgetClient.toString()}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Бюджет исполнителя</label>
          <input
            name="budgetExecutor"
            type="number"
            step="0.01"
            defaultValue={order.budgetExecutor.toString()}
            required
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm tabular-nums"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Прибыль (авто)</label>
          <input
            readOnly
            value={order.profit.toString()}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm tabular-nums"
          />
          {marginPct !== null && (
            <p className="mt-1 text-xs text-zinc-500">Маржа: {marginPct}% от клиента</p>
          )}
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-zinc-600">
          Требуемые навыки (для авто-подбора, через запятую)
        </label>
        <input
          name="requiredSkills"
          defaultValue={order.requiredSkills.join(", ")}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          placeholder="react, figma"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-zinc-600">Статус</label>
          <select
            name="status"
            defaultValue={order.status}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="LEAD">LEAD</option>
            <option value="IN_PROGRESS">IN PROGRESS</option>
            <option value="REVIEW">REVIEW</option>
            <option value="DONE">DONE</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Исполнитель</label>
          <input
            type="search"
            placeholder="Фильтр по навыку (тег)"
            value={skillTag}
            onChange={(e) => setSkillTag(e.target.value)}
            className="mb-2 mt-1 w-full rounded-md border border-dashed border-zinc-300 px-3 py-1.5 text-xs"
          />
          <select
            name="executorId"
            defaultValue={order.executorId ?? ""}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {filteredExecutors.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · score {executorScores[u.id] ?? "—"}
                {u.skills.length ? ` · ${u.skills.join(", ")}` : ""}
              </option>
            ))}
          </select>
          <div className="mt-2">
            <AdminAutoAssignButton orderId={order.id} />
          </div>
          {skillTag && filteredExecutors.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">Нет исполнителей с таким тегом</p>
          )}
        </div>
      </div>
      {order.lead && (
        <p className="text-xs text-zinc-500">
          Источник: лид {order.lead.id} · {order.lead.status}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
      >
        {loading ? "…" : "Сохранить"}
      </button>
    </form>
  );
}
