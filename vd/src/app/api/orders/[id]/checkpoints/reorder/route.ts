import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id: orderId } = await params;

  const body = (await req.json()) as { orderedIds?: string[] };
  if (!body.orderedIds?.length) {
    return NextResponse.json({ error: "orderedIds required" }, { status: 400 });
  }

  const existing = await prisma.checkpoint.findMany({
    where: { orderId },
    select: { id: true },
  });
  if (existing.length !== body.orderedIds.length) {
    return NextResponse.json({ error: "ids mismatch" }, { status: 400 });
  }
  const set = new Set(existing.map((c) => c.id));
  for (const id of body.orderedIds) {
    if (!set.has(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
  }

  await prisma.$transaction(
    body.orderedIds.map((id, idx) =>
      prisma.checkpoint.update({ where: { id }, data: { position: idx } }),
    ),
  );

  return NextResponse.json({ ok: true });
}
