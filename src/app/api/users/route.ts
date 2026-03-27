import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { generatePassword } from "@/lib/generate-password";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;

  const body = (await req.json()) as {
    name?: string;
    email?: string;
    skills?: string[];
  };

  const name = body.name?.trim();
  const emailRaw = body.email?.trim().toLowerCase();
  if (!name || !emailRaw) {
    return NextResponse.json(
      { error: "Укажите имя и email" },
      { status: 400 },
    );
  }

  const exists = await prisma.user.findUnique({ where: { email: emailRaw } });
  if (exists) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже есть" },
      { status: 409 },
    );
  }

  const skills = Array.isArray(body.skills)
    ? body.skills.map((s) => String(s).trim()).filter(Boolean)
    : [];

  const plain = generatePassword(10);
  const passwordHash = await hash(plain, 10);

  const created = await prisma.user.create({
    data: {
      name,
      email: emailRaw,
      passwordHash,
      role: "executor",
      status: "active",
      skills,
    },
    select: { id: true, email: true, name: true },
  });

  await writeAudit({
    entityType: "user",
    entityId: created.id,
    actionType: "create_user",
    changedById: admin.id,
    diff: {
      email: created.email,
      name: created.name,
      skills,
    },
  });

  return NextResponse.json({
    id: created.id,
    email: created.email,
    generated_password: plain,
  });
}

export async function GET(req: Request) {
  const user = await requireAdmin();
  if (user instanceof NextResponse) return user;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const skill = searchParams.get("skill");

  const users = await prisma.user.findMany({
    where: {
      role: "executor",
      ...(status ? { status: status as "active" | "banned" } : {}),
      ...(skill ? { skills: { has: skill } } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      skills: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(users);
}
