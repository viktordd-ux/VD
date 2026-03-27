import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { generatePassword } from "@/lib/generate-password";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.role !== "executor") {
    return NextResponse.json(
      { error: "Сброс пароля только для исполнителей" },
      { status: 400 },
    );
  }

  const plain = generatePassword(10);
  const passwordHash = await hash(plain, 10);

  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });

  await writeAudit({
    entityType: "user",
    entityId: id,
    actionType: "reset_password",
    changedById: admin.id,
    diff: { email: existing.email, name: existing.name },
  });

  return NextResponse.json({
    id: existing.id,
    email: existing.email,
    generated_password: plain,
  });
}
