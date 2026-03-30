import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import {
  auditActionLabel,
  auditEntityLabel,
  userRoleLabel,
} from "@/lib/ui-labels";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const rows = await prisma.auditLog.findMany({
    orderBy: { changedAt: "desc" },
    take: 100,
    include: {
      changedBy: { select: { name: true, email: true, role: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">История</h1>
      <p className="text-sm text-[var(--muted)]">
        Последние записи журнала: кто, когда и что изменил в системе.
      </p>
      {rows.length === 0 ? (
        <EmptyState
          title="Записей в журнале пока нет"
          description="Здесь появятся действия пользователей при работе с заказами и лидами."
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-[color:var(--border)] bg-[color:var(--muted-bg)]">
              <tr>
                <th className={thClass}>Когда</th>
                <th className={thClass}>Кто</th>
                <th className={thClass}>Сущность</th>
                <th className={thClass}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={trClass}>
                  <td className={`whitespace-nowrap ${tdClass} text-[var(--muted)]`}>
                    {r.changedAt.toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className={tdClass}>
                    {r.changedBy.name}
                    <span className="block text-xs text-[var(--muted)]">
                      {userRoleLabel(r.changedBy.role)}
                    </span>
                  </td>
                  <td className={tdClass}>
                    {auditEntityLabel(r.entityType)} · {r.entityId.slice(0, 8)}…
                  </td>
                  <td className={`${tdClass} text-xs font-medium text-[var(--text)]`}>
                    {auditActionLabel(r.actionType)}
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
