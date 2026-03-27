import Link from "next/link";
import prisma from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Шаблоны заказов
        </h1>
        <Link
          href="/admin/templates/new"
          className={cn(primaryLink, "min-h-11 w-full justify-center sm:w-auto")}
        >
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
        <>
          <div className="hidden md:block">
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
          </div>

          <div className="space-y-3 md:hidden">
            {list.map((t) => (
              <Card key={t.id} className="p-4 shadow-sm">
                <p className="text-base font-semibold text-zinc-900">{t.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                  {t.tags.length ? t.tags.join(", ") : "—"}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    href={`/admin/templates/${t.id}`}
                    className="flex min-h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    Редактировать
                  </Link>
                  <Link
                    href={`/admin/quick?template=${t.id}`}
                    className="flex min-h-11 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Создать заказ из шаблона
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
