import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { orderIsActive, leadIsActive } from "@/lib/active-scope";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const now = new Date();

  const [review, newLeads, overdue] = await Promise.all([
    prisma.order.count({
      where: { ...orderIsActive, status: "REVIEW" },
    }),
    prisma.lead.count({
      where: { ...leadIsActive, status: "NEW" },
    }),
    prisma.order.count({
      where: {
        ...orderIsActive,
        status: { not: "DONE" },
        deadline: { lt: now },
      },
    }),
  ]);

  return NextResponse.json({ review, newLeads, overdue });
}
