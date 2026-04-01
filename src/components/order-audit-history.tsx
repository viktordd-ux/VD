"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Row = {
  id: string;
  actionType: string;
  changedAt: string;
  diff: unknown;
  changedBy: { name: string; role: string };
};

export function OrderAuditHistory({ orderId }: { orderId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/audit`);
      if (!res.ok) return;
      const data = (await res.json()) as Row[];
      if (!cancelled) setRows(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (rows === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-full max-w-md rounded-md" />
        <Skeleton className="h-4 w-full max-w-lg rounded-md" />
        <Skeleton className="h-4 w-2/3 rounded-md" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">Записей аудита по заказу нет.</p>;
  }

  return (
    <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
      {rows.map((r) => (
        <li key={r.id} className="border-b border-zinc-100 pb-2 last:border-0">
          <span className="text-zinc-500">
            {new Date(r.changedAt).toLocaleString("ru-RU")} · {r.changedBy.name} (
            {r.changedBy.role})
          </span>
          <span className="ml-2 font-mono text-xs text-zinc-800">{r.actionType}</span>
        </li>
      ))}
    </ul>
  );
}
