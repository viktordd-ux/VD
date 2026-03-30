import Link from "next/link";
import prisma from "@/lib/prisma";
import { cn } from "@/lib/cn";
import { leadIsActive } from "@/lib/active-scope";
import { LeadsBulkProvider } from "./leads-bulk";
import { LeadsListClient } from "./leads-list-client";

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

        <LeadsListClient initialLeads={leads} />
      </div>
    </LeadsBulkProvider>
  );
}
