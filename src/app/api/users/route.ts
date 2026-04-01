import { hash } from "bcryptjs";
import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { generatePassword } from "@/lib/generate-password";
import { getExecutorMetricsMap } from "@/lib/executor-matching";
import { getAccessibleOrganizationIds, getPrimaryOrganizationIdForUser } from "@/lib/org-scope";
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

  const organizationId = await getPrimaryOrganizationIdForUser(admin.id);
  if (!organizationId) {
    return NextResponse.json(
      { error: "Нет организации: создайте организацию перед добавлением исполнителей" },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
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
    await tx.membership.create({
      data: {
        userId: u.id,
        organizationId,
        role: MembershipRole.EXECUTOR,
      },
    });
    return u;
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

  const orgIds = await getAccessibleOrganizationIds(user.id);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const skill = searchParams.get("skill");

  const users = await prisma.user.findMany({
    where: {
      role: "executor",
      memberships: { some: { organizationId: { in: orgIds } } },
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

  const metrics = await getExecutorMetricsMap(users.map((u) => u.id), {
    organizationIds: orgIds,
  });
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
