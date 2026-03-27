import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<{
    name: string;
    status: "active" | "banned";
    skills: string[];
  }>;

  if (body.skills !== undefined && existing.role !== "executor") {
    return NextResponse.json(
      { error: "Навыки только у исполнителей" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      status: body.status ?? undefined,
      ...(body.skills !== undefined ? { skills: body.skills } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      skills: true,
    },
  });

  await writeAudit({
    entityType: "user",
    entityId: id,
    actionType: "update",
    changedById: admin.id,
    diff: { before: existing, after: updated },
  });

  return NextResponse.json(updated);
}
