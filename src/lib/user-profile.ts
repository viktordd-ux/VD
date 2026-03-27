import type { User } from "@prisma/client";

/** Отображаемое ФИО: приоритет у first/last, иначе legacy name. */
export function formatUserDisplayName(user: Pick<User, "firstName" | "lastName" | "name">): string {
  const fn = user.firstName?.trim() ?? "";
  const ln = user.lastName?.trim() ?? "";
  const combined = `${fn} ${ln}`.trim();
  if (combined) return combined;
  return user.name?.trim() || "—";
}

export function syncNameFromProfile(firstName: string, lastName: string): string {
  const n = `${firstName.trim()} ${lastName.trim()}`.trim();
  return n || "Исполнитель";
}
