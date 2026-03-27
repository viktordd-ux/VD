import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { orderIsActive } from "@/lib/active-scope";
import { deleteStorageFile, getFileSignedUrl, isStorageFileEntry } from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await prisma.order.findFirst({
    where: { id: file.orderId, ...orderIsActive },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.role === "executor" && order.executorId !== user.id) {
    return forbidden();
  }

  if (file.kind === "link" && file.externalUrl) {
    return NextResponse.redirect(file.externalUrl);
  }

  if (!isStorageFileEntry(file)) {
    return NextResponse.json({ error: "Запись без файла" }, { status: 404 });
  }

  try {
    const signedUrl = await getFileSignedUrl(file.filePath!);
    return NextResponse.redirect(signedUrl);
  } catch {
    return NextResponse.json({ error: "Файл недоступен" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "admin") return forbidden();

  const { id } = await params;
  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isStorageFileEntry(file)) {
    try {
      await deleteStorageFile(file.filePath!);
    } catch {
      // Storage delete failure is non-fatal
    }
  }

  await prisma.file.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
