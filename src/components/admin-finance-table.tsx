"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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

export function AdminFinanceTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
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
    setEditing(null);
    router.refresh();
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
    router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
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
                className={`border-b border-zinc-50 last:border-0 ${isEditing ? "bg-amber-50/60" : ""}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {o.title}
                  </Link>
                  <p className="text-xs text-zinc-400">{o.clientName}</p>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600">
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
                        className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={formData.budgetExecutor}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, budgetExecutor: e.target.value }))
                        }
                        className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-2 tabular-nums font-semibold text-emerald-800">
                      {profit.toFixed(0)}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-zinc-500">{margin}%</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1.5">
                        <input
                          type="text"
                          placeholder="Причина (необязательно)"
                          value={formData.note}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, note: e.target.value }))
                          }
                          className="w-40 rounded border border-zinc-300 px-2 py-1 text-xs"
                        />
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void saveEdit(o.id)}
                            className="rounded bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                          >
                            {isBusy ? "…" : "Сохранить"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 tabular-nums">{Number(o.budgetClient).toFixed(0)}</td>
                    <td className="px-4 py-3 tabular-nums">{Number(o.budgetExecutor).toFixed(0)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-emerald-800">
                      {Number(o.profit).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-500">{margin}%</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(o)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void deleteRow(o.id, o.title)}
                          className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
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
        <p className="p-4 text-sm text-zinc-500">Нет заказов.</p>
      )}
    </div>
  );
}
