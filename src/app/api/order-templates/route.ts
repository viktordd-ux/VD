import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff, requireUser } from "@/lib/api-auth";
import { parseDefaultCheckpoints } from "@/lib/order-template";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const list = await prisma.orderTemplate.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const user = await requireStaff();
  if (user instanceof NextResponse) return user;

  const body = (await req.json()) as {
    title?: string;
    descriptionTemplate?: string;
    defaultCheckpoints?: unknown;
    tags?: string[];
  };

  if (!body.title?.trim() || body.descriptionTemplate === undefined) {
    return NextResponse.json(
      { error: "title и descriptionTemplate обязательны" },
      { status: 400 },
    );
  }

  const rawArr = body.defaultCheckpoints ?? [];
  if (!Array.isArray(rawArr)) {
    return NextResponse.json({ error: "defaultCheckpoints должен быть массивом" }, { status: 400 });
  }
  const cp = parseDefaultCheckpoints(rawArr);
  if (cp.length !== rawArr.length) {
    return NextResponse.json(
      { error: "Некорректные элементы в defaultCheckpoints" },
      { status: 400 },
    );
  }

  const created = await prisma.orderTemplate.create({
    data: {
      title: body.title.trim(),
      descriptionTemplate: body.descriptionTemplate,
      defaultCheckpoints: cp as unknown as import("@prisma/client").Prisma.InputJsonValue,
      tags: body.tags?.map((t) => t.trim()).filter(Boolean) ?? [],
    },
  });

  return NextResponse.json(created);
}
