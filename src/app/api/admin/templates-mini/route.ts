import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

/** GET /api/admin/templates-mini — id + title для быстрого создания заказа. */
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const templates = await prisma.orderTemplate.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return NextResponse.json({ templates });
}
