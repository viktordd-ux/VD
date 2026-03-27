import Link from "next/link";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import {
  TableWrap,
  tdClass,
  thClass,
  trClass,
} from "@/components/table-wrap";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const primaryLink = cn(
  "inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800",
);

export default async function TemplatesPage() {
  const list = await prisma.orderTemplate.findMany({
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Шаблоны заказов
        </h1>
        <Link href="/admin/templates/new" className={primaryLink}>
          Новый шаблон
        </Link>
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="Шаблонов пока нет"
          description="Создайте шаблон с этапами и текстом ТЗ, чтобы быстрее заводить заказы."
          action={
            <Link href="/admin/templates/new" className={primaryLink}>
              Создать шаблон
            </Link>
          }
        />
      ) : (
        <TableWrap>
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/90">
              <tr>
                <th className={thClass}>Название</th>
                <th className={thClass}>Теги</th>
                <th className={thClass}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={trClass}>
                  <td className={`${tdClass} font-medium`}>{t.title}</td>
                  <td className={`${tdClass} text-zinc-600`}>
                    {t.tags.length ? t.tags.join(", ") : "—"}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/admin/templates/${t.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Редактировать
                      </Link>
                      <Link
                        href={`/admin/quick?template=${t.id}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Создать заказ из шаблона
                      </Link>
                    </div>
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
