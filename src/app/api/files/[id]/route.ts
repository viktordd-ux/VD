import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forbidden, requireUser } from "@/lib/api-auth";
import { canStaffManageOrder, getOrderAccessWhereInput } from "@/lib/order-access";
import { deleteStorageFile, getFileSignedUrl, isStorageFileEntry } from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const order = await prisma.order.findFirst({
    where: { id: file.orderId, ...accessWhere },
  });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
  const { id } = await params;

  const file = await prisma.file.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canStaffManageOrder(user.id, file.orderId))) return forbidden();

  const accessWhere = await getOrderAccessWhereInput(user.id);
  const orderOk = await prisma.order.findFirst({
    where: { id: file.orderId, ...accessWhere },
  });
  if (!orderOk) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
