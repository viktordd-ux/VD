import prisma from "@/lib/prisma";
import { QuickClient } from "./quick-client";

export const dynamic = "force-dynamic";

export default async function QuickPage() {
  const templates = await prisma.orderTemplate.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return <QuickClient templates={templates} />;
}
