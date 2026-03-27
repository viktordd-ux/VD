"use client";

import type { CheckpointStatus } from "@prisma/client";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  auditActionLabel,
  auditEntityLabel,
  checkpointStatusLabel,
  userRoleLabel,
} from "@/lib/ui-labels";

type ChangedBy = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type AuditRow = {
  id: string;
  actionType: string;
  changedAt: string;
  entityType: string;
  entityId: string;
  changedBy: ChangedBy;
};

type CpRow = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  updatedAt: string;
  position: number;
};

type Tab = "all" | "checkpoints" | "audit";

export function OrderHistoryTabs({ orderId }: { orderId: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [checkpoints, setCheckpoints] = useState<CpRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/audit/history`,
      );
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as {
        audit: AuditRow[];
        checkpoints: CpRow[];
      };
      if (!cancelled) {
        setAudit(data.audit);
        setCheckpoints(data.checkpoints);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "all", label: "Вся хронология" },
    { id: "checkpoints", label: "Этапы" },
    { id: "audit", label: "Аудит" },
  ];

  if (loading) {
    return <p className="text-sm text-zinc-500">Загрузка…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "border border-b-0 border-zinc-200 bg-white text-zinc-900"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "checkpoints" && (
        <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {checkpoints.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5"
            >
              <span className="font-medium">{c.title}</span>
              <span className="ml-2">
                <Badge
                  tone={
                    c.status === "done"
                      ? "success"
                      : c.status === "awaiting_approval"
                        ? "review"
                        : "neutral"
                  }
                >
                  {checkpointStatusLabel[c.status as CheckpointStatus] ??
                    c.status}
                </Badge>
              </span>
              <p className="mt-1 text-xs text-zinc-500">
                Обновлено: {new Date(c.updatedAt).toLocaleString("ru-RU")}
              </p>
            </li>
          ))}
          {checkpoints.length === 0 && (
            <li className="text-zinc-500">Этапов пока нет</li>
          )}
        </ul>
      )}

      {tab === "audit" && (
        <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {audit.map((r) => (
            <li key={r.id} className="border-b border-zinc-100 pb-2 last:border-0">
              <span className="text-zinc-500">
                {new Date(r.changedAt).toLocaleString("ru-RU")} ·{" "}
                {r.changedBy.name} ({userRoleLabel(r.changedBy.role)})
              </span>
              <span className="ml-2 text-xs font-medium text-zinc-800">
                {auditActionLabel(r.actionType)}
              </span>
              <span className="ml-1 text-xs text-zinc-400">
                [{auditEntityLabel(r.entityType)}]
              </span>
            </li>
          ))}
          {audit.length === 0 && (
            <li className="text-zinc-500">Записей аудита нет</li>
          )}
        </ul>
      )}

      {tab === "all" && (
        <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {audit.map((r) => (
            <li
              key={r.id}
              className={`border-b border-zinc-100 pb-2 last:border-0 ${
                r.entityType === "checkpoint" ? "rounded-r-lg bg-amber-50/50 pl-2" : ""
              }`}
            >
              <span className="text-zinc-500">
                {new Date(r.changedAt).toLocaleString("ru-RU")} · {r.changedBy.name}
              </span>
              <span className="ml-2 text-xs font-medium">
                {auditActionLabel(r.actionType)}
              </span>
              <span className="ml-1 text-xs text-zinc-400">
                [{auditEntityLabel(r.entityType)}]
              </span>
            </li>
          ))}
          {audit.length === 0 && (
            <li className="text-zinc-500">Записей пока нет</li>
          )}
        </ul>
      )}
    </div>
  );
}
