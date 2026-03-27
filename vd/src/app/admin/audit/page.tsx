import prisma from "@/lib/prisma";

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
      <h1 className="text-2xl font-semibold tracking-tight">Аудит</h1>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Когда</th>
              <th className="px-4 py-3">Кто</th>
              <th className="px-4 py-3">Сущность</th>
              <th className="px-4 py-3">Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-50 align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                  {r.changedAt.toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-4 py-3">
                  {r.changedBy.name}
                  <span className="block text-xs text-zinc-500">{r.changedBy.role}</span>
                </td>
                <td className="px-4 py-3">
                  {r.entityType} · {r.entityId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.actionType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
