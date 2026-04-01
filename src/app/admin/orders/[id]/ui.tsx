"use client";

import { Prisma } from "@prisma/client";
import type { User } from "@prisma/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AdminAutoAssignButton } from "@/components/admin-auto-assign";
import { useAdminOrder } from "@/components/admin-order/admin-order-context";
import { useToast } from "@/components/toast-provider";
import { useExecutors } from "@/context/executors-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  normalizeOrderForClient,
  parseAdminOrderFromApiJson,
  type OrderWithRelations,
} from "@/lib/order-client-deserialize";
import { queryKeys } from "@/lib/query-keys";
import type { AdminOrderBundleCached } from "@/lib/react-query-realtime";
import { leadStatusLabel, orderStatusLabel } from "@/lib/ui-labels";

type SaveBody = {
  title: string;
  description: string;
  clientName: string;
  platform: string;
  deadline: string | null;
  budgetClient: number;
  budgetExecutor: number;
  status: OrderWithRelations["status"];
  executorId: string | null;
  requiredSkills: string[];
};

function buildOptimisticOrder(
  prev: OrderWithRelations,
  body: SaveBody,
): OrderWithRelations {
  const budgetClient = new Prisma.Decimal(body.budgetClient);
  const budgetExecutor = new Prisma.Decimal(body.budgetExecutor);
  const profit = budgetClient.minus(budgetExecutor);
  return normalizeOrderForClient({
    ...prev,
    title: body.title,
    description: body.description,
    clientName: body.clientName,
    platform: body.platform,
    deadline: body.deadline ? new Date(body.deadline) : null,
    budgetClient,
    budgetExecutor,
    profit,
    status: body.status,
    executorId: body.executorId,
    requiredSkills: body.requiredSkills,
    updatedAt: new Date(),
  });
}

type ExecutorOption = Pick<User, "id" | "name" | "email" | "skills">;

/** В <option> длинные навыки раздувают нативный список на всю ширину экрана. */
const EXECUTOR_OPTION_MAX_CHARS = 96;

function truncateOptionLabel(text: string, maxLen: number) {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function AdminOrderForm({
  executors,
  executorStats,
}: {
  executors: ExecutorOption[];
  executorStats: Record<
    string,
    { rating: number; completedOrders: number; latePercent: number }
  >;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { order, setOrder, bumpHistory } = useAdminOrder();
  const { refresh: refreshExecutors } = useExecutors();
  const [skillTag, setSkillTag] = useState("");

  const saveMutation = useMutation({
    mutationFn: async (body: SaveBody) => {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save");
      return res.json() as Promise<Record<string, unknown>>;
    },
    onMutate: (body) => {
      const key = queryKeys.adminOrder(order.id);
      const prevBundle = queryClient.getQueryData<AdminOrderBundleCached | null>(
        key,
      );
      const prevOrder = order;
      const optimistic = buildOptimisticOrder(order, body);
      queryClient.setQueryData<AdminOrderBundleCached | null>(key, (old) =>
        old ? { ...old, order: optimistic } : old,
      );
      setOrder(optimistic);
      return { prevBundle, prevOrder, key };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.prevBundle !== undefined && ctx.key) {
        queryClient.setQueryData(ctx.key, ctx.prevBundle);
      }
      if (ctx?.prevOrder) setOrder(ctx.prevOrder);
      toast.error("Не удалось сохранить");
    },
    onSuccess: (data, _body, ctx) => {
      const parsed = parseAdminOrderFromApiJson(data);
      setOrder(parsed);
      if (ctx?.key) {
        queryClient.setQueryData<AdminOrderBundleCached | null>(ctx.key, (old) =>
          old ? { ...old, order: parsed } : old,
        );
      }
      toast.success("Сохранено");
      bumpHistory();
      void refreshExecutors();
    },
  });

  const filteredExecutors = useMemo(() => {
    const t = skillTag.trim().toLowerCase();
    if (!t) return executors;
    return executors.filter((u) =>
      u.skills.some((s) => s.toLowerCase().includes(t)),
    );
  }, [executors, skillTag]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const reqSkillsRaw = String(fd.get("requiredSkills") ?? "");
    const requiredSkills = reqSkillsRaw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const body: SaveBody = {
      title: String(fd.get("title")),
      description: String(fd.get("description")),
      clientName: String(fd.get("clientName")),
      platform: String(fd.get("platform")),
      deadline: fd.get("deadline") ? String(fd.get("deadline")) : null,
      budgetClient: Number(fd.get("budgetClient")),
      budgetExecutor: Number(fd.get("budgetExecutor")),
      status: fd.get("status") as SaveBody["status"],
      executorId: fd.get("executorId") ? String(fd.get("executorId")) : null,
      requiredSkills,
    };
    saveMutation.mutate(body);
  }

  const dl = order.deadline ? order.deadline.toISOString().slice(0, 16) : "";
  const marginPct =
    Number(order.budgetClient) > 0
      ? Math.round(
          (Number(order.profit) / Number(order.budgetClient)) * 100,
        )
      : null;

  const fieldClass =
    "mt-1 w-full min-h-11 rounded-lg border border-[color:var(--border)] bg-[var(--card)] px-3 py-2.5 text-base leading-relaxed text-[var(--text)] placeholder:text-[var(--muted)] outline-none transition-shadow focus:border-[color:var(--ring)] focus:ring-2 focus:ring-[color:var(--ring)]/25 md:min-h-0 md:py-2 md:text-sm";
  const labelClass =
    "text-sm font-medium text-[var(--muted)] md:text-xs";

  return (
    <form
      id="admin-order-edit-form"
      onSubmit={onSubmit}
      className="space-y-4 pb-24 lg:pb-0"
      key={order.updatedAt.toISOString()}
    >
      <Card className="space-y-4 border-[color:var(--border)] bg-[var(--card)] p-4 shadow-sm shadow-black/[0.03] dark:shadow-black/30 md:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Данные заказа
      </h2>
      <div>
        <label className={labelClass}>Название</label>
        <input
          name="title"
          defaultValue={order.title}
          required
          className={fieldClass}
        />
      </div>
      <div>
        <label className={labelClass}>Техническое задание</label>
        <textarea
          name="description"
          defaultValue={order.description}
          required
          rows={6}
          className={`${fieldClass} min-h-[8rem] py-3`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Клиент</label>
          <input
            name="clientName"
            defaultValue={order.clientName}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass}>Платформа</label>
          <input
            name="platform"
            defaultValue={order.platform}
            required
            className={fieldClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Дедлайн</label>
        <input
          type="datetime-local"
          name="deadline"
          defaultValue={dl}
          className={fieldClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Бюджет клиента</label>
          <input
            name="budgetClient"
            type="number"
            step="0.01"
            defaultValue={order.budgetClient.toString()}
            required
            className={`${fieldClass} tabular-nums`}
          />
        </div>
        <div>
          <label className={labelClass}>Бюджет исполнителя</label>
          <input
            name="budgetExecutor"
            type="number"
            step="0.01"
            defaultValue={order.budgetExecutor.toString()}
            required
            className={`${fieldClass} tabular-nums`}
          />
        </div>
        <div>
          <label className={labelClass}>Прибыль (авто)</label>
          <input
            readOnly
            value={order.profit.toString()}
            className="mt-1 w-full min-h-11 rounded-lg border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-3 py-2.5 text-base tabular-nums text-[var(--text)] md:min-h-0 md:py-2 md:text-sm"
          />
          {marginPct !== null && (
            <p className="mt-1 text-xs text-[var(--muted)]">Маржа: {marginPct}% от клиента</p>
          )}
        </div>
      </div>
      <div>
        <label className={labelClass}>
          Требуемые навыки (для авто-подбора, через запятую)
        </label>
        <input
          name="requiredSkills"
          defaultValue={order.requiredSkills.join(", ")}
          className={fieldClass}
          placeholder="react, figma"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Статус</label>
          <select
            name="status"
            defaultValue={order.status}
            className={fieldClass}
          >
            <option value="LEAD">{orderStatusLabel.LEAD}</option>
            <option value="IN_PROGRESS">{orderStatusLabel.IN_PROGRESS}</option>
            <option value="REVIEW">{orderStatusLabel.REVIEW}</option>
            <option value="DONE">{orderStatusLabel.DONE}</option>
          </select>
        </div>
        <div className="min-w-0">
          <label className={labelClass}>Исполнитель</label>
          <input
            type="search"
            placeholder="Фильтр по навыку (тег)"
            value={skillTag}
            onChange={(e) => setSkillTag(e.target.value)}
            className="mb-2 mt-1 w-full min-h-11 rounded-lg border border-dashed border-[color:var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] md:min-h-0 md:py-1.5"
          />
          <select
            name="executorId"
            defaultValue={order.executorId ?? ""}
            className={`${fieldClass} max-w-full min-w-0 truncate`}
          >
            <option value="">—</option>
            {filteredExecutors.map((u) => {
              const st = executorStats[u.id];
              const metricsLabel = st
                ? `⭐ ${st.rating.toFixed(0)} · ${st.completedOrders} зак. · проср. ${st.latePercent.toFixed(0)}%`
                : "—";
              const fullLabel = `${u.name} · ${metricsLabel}${
                u.skills.length ? ` · ${u.skills.join(", ")}` : ""
              }`;
              const shortLabel = truncateOptionLabel(
                fullLabel,
                EXECUTOR_OPTION_MAX_CHARS,
              );
              return (
                <option key={u.id} value={u.id} title={fullLabel}>
                  {shortLabel}
                </option>
              );
            })}
          </select>
          <div className="mt-2 [&_button]:w-full [&_button]:sm:w-auto">
            <AdminAutoAssignButton orderId={order.id} />
          </div>
          {skillTag && filteredExecutors.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">Нет исполнителей с таким тегом</p>
          )}
        </div>
      </div>
      {order.lead && (
        <p className="text-xs text-zinc-500">
          Источник: лид {order.lead.id.slice(0, 8)}… ·{" "}
          {leadStatusLabel[order.lead.status]}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        size="md"
        loading={saveMutation.isPending}
        className="hidden w-full lg:inline-flex"
      >
        Сохранить
      </Button>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-4 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/90 lg:hidden">
        <button
          type="submit"
          form="admin-order-edit-form"
          disabled={saveMutation.isPending}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Skeleton className="mx-auto h-4 w-32 rounded-md bg-white/25" />
          ) : (
            "Сохранить заказ"
          )}
        </button>
      </div>
    </form>
  );
}
