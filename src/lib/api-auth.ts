import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "admin" | "executor";
};

const STAFF_MEMBERSHIP_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.MANAGER,
];

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name,
    role: session.user.role,
  };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireUser(): Promise<
  SessionUser | NextResponse
> {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return user;
}

/**
 * Руководство в любой организации (OWNER / ADMIN / MANAGER) или legacy User.role admin.
 * Не подходит для VIEWER и «чистого» EXECUTOR.
 */
export async function requireStaff(): Promise<SessionUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role === "admin") return user;
  const m = await prisma.membership.findFirst({
    where: { userId: user.id, role: { in: STAFF_MEMBERSHIP_ROLES } },
  });
  if (!m) return forbidden();
  return user;
}

/**
 * Полный админский доступ: legacy admin или OWNER / ADMIN в любой организации (не MANAGER).
 */
export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role === "admin") return user;
  const m = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN] },
    },
  });
  if (!m) return forbidden();
  return user;
}
