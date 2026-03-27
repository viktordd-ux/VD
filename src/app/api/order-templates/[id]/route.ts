import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { parseDefaultCheckpoints } from "@/lib/order-template";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const row = await prisma.orderTemplate.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await prisma.orderTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    title?: string;
    descriptionTemplate?: string;
    defaultCheckpoints?: unknown;
    tags?: string[];
  };

  if (body.defaultCheckpoints !== undefined && !Array.isArray(body.defaultCheckpoints)) {
    return NextResponse.json({ error: "defaultCheckpoints должен быть массивом" }, { status: 400 });
  }

  let checkpointsJson = existing.defaultCheckpoints;
  if (body.defaultCheckpoints !== undefined) {
    const rawArr = body.defaultCheckpoints;
    const cp = parseDefaultCheckpoints(rawArr);
    if (cp.length !== rawArr.length) {
      return NextResponse.json(
        { error: "Некорректные элементы в defaultCheckpoints" },
        { status: 400 },
      );
    }
    checkpointsJson = cp as unknown as typeof existing.defaultCheckpoints;
  }

  const updated = await prisma.orderTemplate.update({
    where: { id },
    data: {
      title: body.title !== undefined ? body.title.trim() : undefined,
      descriptionTemplate:
        body.descriptionTemplate !== undefined ? body.descriptionTemplate : undefined,
      defaultCheckpoints:
        body.defaultCheckpoints !== undefined
          ? (checkpointsJson as Prisma.InputJsonValue)
          : undefined,
      tags: body.tags !== undefined ? body.tags.map((t) => t.trim()).filter(Boolean) : undefined,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;
  const { id } = await params;

  const existing = await prisma.orderTemplate.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.orderTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
