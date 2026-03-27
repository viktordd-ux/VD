import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  role: "admin" | "executor";
};

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

export async function requireAdmin(): Promise<SessionUser | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role !== "admin") return forbidden();
  return user;
}
