import { MembershipRole } from "@prisma/client";

const ROLES = new Set<string>(Object.values(MembershipRole));

/** Тело API: строка enum Prisma или нижний регистр. */
export function parseMembershipRole(input: unknown): MembershipRole | null {
  if (input == null || typeof input !== "string") return null;
  const s = input.trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (ROLES.has(up)) return up as MembershipRole;
  return null;
}
