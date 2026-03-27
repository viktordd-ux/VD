import Link from "next/link";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import { cn } from "@/lib/cn";
import { leadStatusLabel } from "@/lib/ui-labels";
import { ConvertLeadButton } from "./ui";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Лиды</h1>
        <Link
          href="/admin/leads/new"
          className={cn(
            "inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800",
          )}
        >
          Новый лид
        </Link>
      </div>

      {leads.length === 0 ? (
        <EmptyState
          title="Лидов пока нет"
          description="Добавьте первый лид с платформы или из переписки."
          action={
            <Link
              href="/admin/leads/new"
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800"
            >
              Добавить лид
            </Link>
          }
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/90">
              <tr>
                <th className={thClass}>Клиент</th>
                <th className={thClass}>Платформа</th>
                <th className={thClass}>Статус</th>
                <th className={thClass}>Ссылка</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className={trClass}>
                  <td className={`${tdClass} font-medium`}>{l.clientName}</td>
                  <td className={tdClass}>{l.platform}</td>
                  <td className={tdClass}>
                    <Badge
                      tone={
                        l.status === "NEW"
                          ? "neutral"
                          : l.status === "WON"
                            ? "success"
                            : l.status === "LOST"
                              ? "danger"
                              : "warning"
                      }
                    >
                      {leadStatusLabel[l.status]}
                    </Badge>
                  </td>
                  <td className={`max-w-[200px] truncate ${tdClass}`}>
                    <a
                      href={l.link}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {l.link}
                    </a>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    <ConvertLeadButton leadId={l.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </div>
  );
}
