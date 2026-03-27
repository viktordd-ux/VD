import Link from "next/link";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const list = await prisma.orderTemplate.findMany({
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Шаблоны заказов</h1>
        <Link
          href="/admin/templates/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Новый шаблон
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3">Теги</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-3 font-medium">{t.title}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {t.tags.length ? t.tags.join(", ") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href={`/admin/templates/${t.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Редактировать
                    </Link>
                    <Link
                      href={`/admin/quick?template=${t.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Создать заказ из шаблона
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length === 0 && (
        <p className="text-sm text-zinc-500">Шаблонов пока нет — создайте первый.</p>
      )}
    </div>
  );
}
