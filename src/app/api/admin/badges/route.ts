import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { leadIsActive } from "@/lib/active-scope";
import { getOrderAccessWhereInput } from "@/lib/order-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const accessWhere = await getOrderAccessWhereInput(user.id);

  const now = new Date();

  const [review, newLeads, overdue] = await Promise.all([
    prisma.order.count({
      where: { AND: [accessWhere, { status: "REVIEW" }] },
    }),
    prisma.lead.count({
      where: { ...leadIsActive, status: "NEW" },
    }),
    prisma.order.count({
      where: {
        AND: [
          accessWhere,
          { status: { not: "DONE" }, deadline: { lt: now } },
        ],
      },
    }),
  ]);

  return NextResponse.json({ review, newLeads, overdue });
}
