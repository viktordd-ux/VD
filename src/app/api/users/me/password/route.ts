import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";

export async function PATCH(req: Request) {
  const sessionUser = await requireUser();
  if (sessionUser instanceof NextResponse) return sessionUser;

  const body = (await req.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json(
      { error: "Укажите текущий и новый пароль" },
      { status: 400 },
    );
  }

  if (body.newPassword.length < 8) {
    return NextResponse.json(
      { error: "Новый пароль не короче 8 символов" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ok = await compare(body.currentPassword, user.passwordHash);
  if (!ok) {
    return NextResponse.json(
      { error: "Неверный текущий пароль" },
      { status: 401 },
    );
  }

  const passwordHash = await hash(body.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  await writeAudit({
    entityType: "user",
    entityId: user.id,
    actionType: "change_password",
    changedById: user.id,
    diff: { self: true },
  });

  return NextResponse.json({ ok: true });
}
