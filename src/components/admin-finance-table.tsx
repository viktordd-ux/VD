"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

type OrderRow = {
  id: string;
  title: string;
  status: string;
  budgetClient: string;
  budgetExecutor: string;
  profit: string;
  clientName: string;
};

const STATUS_LABEL: Record<string, string> = {
  LEAD: "Лид",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Завершён",
};

export function AdminFinanceTable({ orders: initialOrders }: { orders: OrderRow[] }) {
  const [orders, setOrders] = useState(initialOrders);
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    budgetClient: string;
    budgetExecutor: string;
    note: string;
  }>({ budgetClient: "", budgetExecutor: "", note: "" });

  function startEdit(order: OrderRow) {
    setEditing(order.id);
    setFormData({
      budgetClient: order.budgetClient,
      budgetExecutor: order.budgetExecutor,
      note: "",
    });
  }

  async function saveEdit(id: string) {
    setBusy(id);
    const res = await fetch(`/api/finance/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        budgetClient: Number(formData.budgetClient),
        budgetExecutor: Number(formData.budgetExecutor),
        note: formData.note || null,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      alert("Ошибка сохранения");
      return;
    }
    const data = (await res.json()) as {
      id: string;
      budgetClient: string;
      budgetExecutor: string;
      profit: string;
    };
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              budgetClient: data.budgetClient,
              budgetExecutor: data.budgetExecutor,
              profit: data.profit,
            }
          : o,
      ),
    );
    setEditing(null);
  }

  async function deleteRow(id: string, title: string) {
    if (!confirm(`Удалить заказ «${title}» из финансов?\nЗапись будет скрыта (мягкое удаление).`))
      return;
    setBusy(id);
    const res = await fetch(`/api/finance/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      alert("Ошибка удаления");
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  return (
    <>
    <div className="hidden overflow-x-auto rounded-xl border border-[color:var(--border)] bg-[var(--card)] shadow-sm dark:shadow-black/30 md:block">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-[color:var(--border)] bg-[color:var(--muted-bg)] text-xs uppercase text-[var(--muted)]">
          <tr>
            <th className="px-4 py-3">Заказ</th>
            <th className="px-4 py-3">Статус</th>
            <th className="px-4 py-3">Бюджет клиента</th>
            <th className="px-4 py-3">Бюджет исп.</th>
            <th className="px-4 py-3">Прибыль</th>
            <th className="px-4 py-3">Маржа</th>
            <th className="px-4 py-3">Действия</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const isEditing = editing === o.id;
            const isBusy = busy === o.id;
            const bc = Number(isEditing ? formData.budgetClient : o.budgetClient);
            const be = Number(isEditing ? formData.budgetExecutor : o.budgetExecutor);
            const profit = isEditing ? bc - be : Number(o.profit);
            const margin = bc > 0 ? ((profit / bc) * 100).toFixed(1) : "—";

            return (
              <tr
                key={o.id}
                className={`border-b border-[color:var(--border)] last:border-0 ${isEditing ? "bg-amber-500/[0.12] dark:bg-amber-950/50" : ""}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-medium text-[var(--text)] hover:underline"
                  >
                    {o.title}
                  </Link>
                  <p className="text-xs text-[var(--muted)]">{o.clientName}</p>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {STATUS_LABEL[o.status] ?? o.status}
                </td>

                {isEditing ? (
                  <>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={formData.budgetClient}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, budgetClient: e.target.value }))
                        }
                        className="w-28 rounded border border-[color:var(--border)] bg-[var(--bg)] px-2 py-1 text-sm tabular-nums text-[var(--text)]"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={formData.budgetExecutor}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, budgetExecutor: e.target.value }))
                        }
                        className="w-28 rounded border border-[color:var(--border)] bg-[var(--bg)] px-2 py-1 text-sm tabular-nums text-[var(--text)]"
                      />
                    </td>
                    <td className="px-4 py-2 tabular-nums font-semibold text-[var(--text)]">
                      {profit.toFixed(0)}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-[var(--muted)]">{margin}%</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="text"
                          placeholder="Причина (необязательно)"
                          value={formData.note}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, note: e.target.value }))
                          }
                          className="w-40 rounded border border-[color:var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)]"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void saveEdit(o.id)}
                            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                          >
                            {isBusy ? "…" : "Сохранить"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded border border-[color:var(--border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--text)] hover:bg-[color:var(--muted-bg)]"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 tabular-nums text-[var(--text)]">
                      {Number(o.budgetClient).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--text)]">
                      {Number(o.budgetExecutor).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-[var(--text)]">
                      {Number(o.profit).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[var(--muted)]">{margin}%</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(o)}
                          className="text-xs font-medium text-[var(--text)] hover:underline"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void deleteRow(o.id, o.title)}
                          className="text-xs font-medium text-[var(--muted)] hover:underline disabled:opacity-50"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {orders.length === 0 && (
        <p className="p-4 text-sm text-[var(--muted)]">Нет заказов.</p>
      )}
    </div>

    <div className="space-y-3 md:hidden">
      {orders.length === 0 && (
        <p className="rounded-xl border border-[color:var(--border)] bg-[var(--card)] p-4 text-sm text-[var(--muted)] shadow-sm">
          Нет заказов.
        </p>
      )}
      {orders.map((o) => {
        const isEditing = editing === o.id;
        const isBusy = busy === o.id;
        const bc = Number(isEditing ? formData.budgetClient : o.budgetClient);
        const be = Number(isEditing ? formData.budgetExecutor : o.budgetExecutor);
        const profit = isEditing ? bc - be : Number(o.profit);
        const margin = bc > 0 ? ((profit / bc) * 100).toFixed(1) : "—";

        return (
          <Card
            key={o.id}
            className={`p-4 shadow-sm ${isEditing ? "ring-2 ring-amber-500/50 dark:ring-amber-400/40" : ""}`}
          >
            <div className="border-b border-[color:var(--border)] pb-3">
              <Link
                href={`/admin/orders/${o.id}`}
                className="text-base font-semibold text-[var(--text)] hover:underline"
              >
                {o.title}
              </Link>
              <p className="mt-1 text-sm text-[var(--muted)]">{o.clientName}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {STATUS_LABEL[o.status] ?? o.status}
              </p>
            </div>

            {isEditing ? (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-sm font-medium text-[var(--muted)]">Бюджет клиента</label>
                  <input
                    type="number"
                    value={formData.budgetClient}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, budgetClient: e.target.value }))
                    }
                    className="mt-1 w-full min-h-11 rounded-lg border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2 text-base tabular-nums text-[var(--text)]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--muted)]">Бюджет исполнителя</label>
                  <input
                    type="number"
                    value={formData.budgetExecutor}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, budgetExecutor: e.target.value }))
                    }
                    className="mt-1 w-full min-h-11 rounded-lg border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2 text-base tabular-nums text-[var(--text)]"
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm tabular-nums">
                  <span>
                    <span className="text-[var(--muted)]">Прибыль: </span>
                    <span className="font-semibold text-[var(--text)]">{profit.toFixed(0)}</span>
                  </span>
                  <span>
                    <span className="text-[var(--muted)]">Маржа: </span>
                    <span className="text-[var(--muted)]">{margin}%</span>
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--muted)]">Причина (необязательно)</label>
                  <input
                    type="text"
                    placeholder="Причина изменения"
                    value={formData.note}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, note: e.target.value }))
                    }
                    className="mt-1 w-full min-h-11 rounded-lg border border-[color:var(--border)] bg-[var(--bg)] px-3 py-2 text-base text-[var(--text)] placeholder:text-[var(--muted)]"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void saveEdit(o.id)}
                    className="min-h-11 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {isBusy ? "…" : "Сохранить"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="min-h-11 w-full rounded-lg border border-[color:var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[color:var(--muted-bg)]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted)]">Бюджет клиента</dt>
                    <dd className="tabular-nums font-medium text-[var(--text)]">
                      {Number(o.budgetClient).toFixed(0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted)]">Бюджет исп.</dt>
                    <dd className="tabular-nums font-medium text-[var(--text)]">
                      {Number(o.budgetExecutor).toFixed(0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted)]">Прибыль</dt>
                    <dd className="tabular-nums font-semibold text-[var(--text)]">
                      {Number(o.profit).toFixed(0)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--muted)]">Маржа</dt>
                    <dd className="tabular-nums text-[var(--muted)]">{margin}%</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--border)] pt-3">
                  <button
                    type="button"
                    onClick={() => startEdit(o)}
                    className="min-h-11 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--muted-bg)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[color:var(--elevate)]"
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void deleteRow(o.id, o.title)}
                    className="min-h-11 w-full text-sm font-medium text-[var(--muted)] underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    Удалить из финансов
                  </button>
                </div>
              </>
            )}
          </Card>
        );
      })}
    </div>
    </>
  );
}
