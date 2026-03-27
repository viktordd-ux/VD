import Link from "next/link";
import prisma from "@/lib/prisma";
import { ConvertLeadButton } from "./ui";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  NEW: "NEW",
  IN_CHAT: "IN CHAT",
  WON: "WON",
  LOST: "LOST",
};

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Лиды</h1>
        <Link
          href="/admin/leads/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Новый лид
        </Link>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Платформа</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Ссылка</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-4 py-3 font-medium">{l.clientName}</td>
                <td className="px-4 py-3">{l.platform}</td>
                <td className="px-4 py-3">{statusLabels[l.status] ?? l.status}</td>
                <td className="max-w-[200px] truncate px-4 py-3">
                  <a
                    href={l.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {l.link}
                  </a>
                </td>
                <td className="px-4 py-3 text-right">
                  <ConvertLeadButton leadId={l.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
