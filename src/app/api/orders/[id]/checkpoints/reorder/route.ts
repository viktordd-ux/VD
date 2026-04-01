import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { canStaffManageOrder } from "@/lib/order-access";
import { revalidateOrderViews } from "@/lib/revalidate-app";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  if (!(await canStaffManageOrder(user.id, orderId))) return forbidden();

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
  for (const cid of body.orderedIds) {
    if (!set.has(cid)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }
  }

  await prisma.$transaction(
    body.orderedIds.map((cid, idx) =>
      prisma.checkpoint.update({ where: { id: cid }, data: { position: idx } }),
    ),
  );

  revalidateOrderViews(orderId);
  return NextResponse.json({ ok: true });
}
