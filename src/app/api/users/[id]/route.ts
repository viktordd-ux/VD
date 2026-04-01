import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { writeAudit } from "@/lib/audit";
import { parseMembershipRole } from "@/lib/membership-role-parse";
import { getPrimaryOrganizationIdForUser } from "@/lib/org-scope";
import { syncNameFromProfile } from "@/lib/user-profile";
import { revalidateAdminUsers } from "@/lib/revalidate-app";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.role !== "executor") {
    return NextResponse.json(
      { error: "Безвозвратно удалять можно только учётные записи исполнителей" },
      { status: 400 },
    );
  }
  if (existing.id === admin.id) {
    return NextResponse.json({ error: "Нельзя удалить собственную учётную запись" }, { status: 400 });
  }

  await writeAudit({
    entityType: "user",
    entityId: id,
    actionType: "delete",
    changedById: admin.id,
    diff: {
      deletedEmail: existing.email,
      deletedName: existing.name,
    },
  });

  await prisma.user.delete({ where: { id } });

  revalidateAdminUsers();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: Params) {
  const admin = await requireAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<{
    name: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    telegram: string | null;
    telegramId: string | null;
    status: "active" | "banned";
    skills: string[];
    primarySkill: string;
    onboarded: boolean;
    /** Роль в организации (`MembershipRole`). */
    membershipRole: string;
  }>;

  let parsedMembershipRole: MembershipRole | undefined;
  if (body.membershipRole !== undefined) {
    const mr = parseMembershipRole(body.membershipRole);
    if (!mr) {
      return NextResponse.json({ error: "Некорректная роль" }, { status: 400 });
    }
    const organizationId = await getPrimaryOrganizationIdForUser(admin.id);
    if (!organizationId) {
      return NextResponse.json(
        { error: "Нет организации" },
        { status: 400 },
      );
    }
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: id, organizationId },
      },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "Нет членства в организации" },
        { status: 400 },
      );
    }
    parsedMembershipRole = mr;
  }

  const effectiveRole =
    parsedMembershipRole !== undefined
      ? parsedMembershipRole === MembershipRole.EXECUTOR
        ? "executor"
        : "admin"
      : existing.role;

  if (
    (body.skills !== undefined ||
      body.primarySkill !== undefined ||
      body.firstName !== undefined ||
      body.lastName !== undefined) &&
    effectiveRole !== "executor"
  ) {
    return NextResponse.json(
      { error: "Поля профиля исполнителя только для исполнителей" },
      { status: 400 },
    );
  }

  const skills =
    body.skills !== undefined
      ? body.skills.map((s) => String(s).trim()).filter(Boolean)
      : undefined;
  const firstName =
    body.firstName !== undefined ? String(body.firstName).trim() : undefined;
  const lastName =
    body.lastName !== undefined ? String(body.lastName).trim() : undefined;
  const phone =
    body.phone !== undefined
      ? body.phone === null || body.phone === ""
        ? null
        : String(body.phone).trim()
      : undefined;
  const telegram =
    body.telegram !== undefined
      ? body.telegram === null || body.telegram === ""
        ? null
        : String(body.telegram).trim()
      : undefined;
  const telegramId =
    body.telegramId !== undefined
      ? body.telegramId === null || body.telegramId === ""
        ? null
        : String(body.telegramId).trim()
      : undefined;
  if (telegramId !== undefined) {
    if (effectiveRole !== "executor") {
      return NextResponse.json(
        { error: "Telegram ID только для исполнителей" },
        { status: 400 },
      );
    }
    if (telegramId !== null && !/^-?\d+$/.test(telegramId)) {
      return NextResponse.json(
        { error: "Telegram ID — число (например из @userinfobot)" },
        { status: 400 },
      );
    }
  }
  const primarySkill =
    body.primarySkill !== undefined ? String(body.primarySkill).trim() : undefined;

  if (primarySkill !== undefined && skills !== undefined && !skills.includes(primarySkill)) {
    return NextResponse.json(
      { error: "Основной навык должен быть среди навыков" },
      { status: 400 },
    );
  }

  if (
    skills !== undefined &&
    primarySkill === undefined &&
    effectiveRole === "executor" &&
    existing.primarySkill &&
    !skills.includes(existing.primarySkill)
  ) {
    return NextResponse.json(
      { error: "Укажите основной навык или оставьте его в списке навыков" },
      { status: 400 },
    );
  }

  const resolvedName =
    effectiveRole === "executor"
      ? body.name !== undefined
        ? body.name
        : firstName !== undefined || lastName !== undefined
          ? syncNameFromProfile(
              firstName ?? existing.firstName,
              lastName ?? existing.lastName,
            )
          : undefined
      : body.name !== undefined
        ? body.name
        : undefined;

  if (parsedMembershipRole !== undefined) {
    const organizationId = await getPrimaryOrganizationIdForUser(admin.id);
    if (organizationId) {
      await prisma.membership.updateMany({
        where: { userId: id, organizationId },
        data: { role: parsedMembershipRole },
      });
    }
  }

  const legacyRoleFromMembership =
    parsedMembershipRole !== undefined
      ? parsedMembershipRole === MembershipRole.EXECUTOR
        ? "executor"
        : "admin"
      : undefined;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(resolvedName !== undefined ? { name: resolvedName } : {}),
      status: body.status ?? undefined,
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(telegram !== undefined ? { telegram } : {}),
      ...(telegramId !== undefined ? { telegramId } : {}),
      ...(skills !== undefined ? { skills } : {}),
      ...(primarySkill !== undefined ? { primarySkill } : {}),
      ...(body.onboarded !== undefined ? { onboarded: body.onboarded } : {}),
      ...(legacyRoleFromMembership !== undefined
        ? { role: legacyRoleFromMembership }
        : {}),
    },
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
    },
  });

  await writeAudit({
    entityType: "user",
    entityId: id,
    actionType: "update",
    changedById: admin.id,
    diff: { before: existing, after: updated },
  });

  revalidateAdminUsers(id);
  return NextResponse.json(updated);
}
