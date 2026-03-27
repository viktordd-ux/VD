import Link from "next/link";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import { leadIsActive } from "@/lib/active-scope";
import { cn } from "@/lib/cn";
import { leadStatusLabel } from "@/lib/ui-labels";
import { LeadsBulkCheckbox, LeadsBulkProvider, LeadsBulkToolbar } from "./leads-bulk";
import { ConvertLeadButton, LeadDeleteButton } from "./ui";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    where: leadIsActive,
    orderBy: { createdAt: "desc" },
  });

  return (
    <LeadsBulkProvider>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Лиды</h1>
        <Link
          href="/admin/leads/new"
          className={cn(
            "inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 sm:w-auto",
          )}
        >
          Новый лид
        </Link>
      </div>

      <LeadsBulkToolbar />

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
        <>
          <div className="hidden md:block">
            <TableWrap>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-zinc-100 bg-zinc-50/90">
                  <tr>
                    <th className={`${thClass} w-10`} aria-label="Выбор" />
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
                      <td className={`${tdClass} align-middle`}>
                        <LeadsBulkCheckbox leadId={l.id} />
                      </td>
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
                        <div className="flex flex-wrap justify-end gap-2">
                          <ConvertLeadButton leadId={l.id} />
                          <LeadDeleteButton leadId={l.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </div>

          <div className="space-y-3 md:hidden">
            {leads.map((l) => (
              <Card key={l.id} className="p-4 shadow-sm">
                <div className="flex items-start gap-3 border-b border-zinc-100 pb-3">
                  <LeadsBulkCheckbox leadId={l.id} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-zinc-900">{l.clientName}</p>
                    <p className="mt-1 text-sm text-zinc-600">{l.platform}</p>
                  </div>
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
                </div>
                <div className="mt-3 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ссылка</p>
                  <a
                    href={l.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-sm text-blue-600 hover:underline"
                  >
                    {l.link}
                  </a>
                </div>
                <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-3">
                  <ConvertLeadButton leadId={l.id} />
                  <LeadDeleteButton leadId={l.id} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
    </LeadsBulkProvider>
  );
}
