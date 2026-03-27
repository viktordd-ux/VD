import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { saveOrderFile } from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  const files = await prisma.file.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(files);
}

export async function POST(req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: orderId } = await params;

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const comment = (formData.get("comment") as string | null) ?? null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const filePath = await saveOrderFile(orderId, buf, file.name);

  const uploadedBy = user.role === "admin" ? "admin" : "executor";

  const row = await prisma.file.create({
    data: {
      orderId,
      uploadedBy,
      filePath,
      comment,
    },
  });

  await writeAudit({
    entityType: "file",
    entityId: row.id,
    actionType: "upload",
    changedById: user.id,
    diff: { orderId, filePath },
  });

  return NextResponse.json(row);
}
