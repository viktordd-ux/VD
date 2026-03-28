import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { generatePassword } from "@/lib/generate-password";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { revalidateAdminUsers } from "@/lib/revalidate-app";

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

  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");

  const plain = generatePassword(10);
  const passwordHash = await hash(plain, 10);

  const created = await prisma.user.create({
    data: {
      name,
      firstName,
      lastName,
      email: emailRaw,
      passwordHash,
      role: "executor",
      status: "active",
      skills,
      primarySkill: skills[0] ?? "",
      onboarded: false,
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

  revalidateAdminUsers(created.id);
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
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      phone: true,
      telegram: true,
      telegramId: true,
      skills: true,
      primarySkill: true,
      onboarded: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const metrics = await getExecutorMetricsMap(users.map((u) => u.id));
  const enriched = users.map((u) => {
    const m = metrics.get(u.id);
    return {
      ...u,
      rating: m?.rating ?? 0,
      completedOrders: m?.completedOrders ?? 0,
      latePercent: m?.latePercent ?? 0,
      avgResponseTime: m?.avgResponseTime ?? null,
    };
  });

  return NextResponse.json(enriched);
}
