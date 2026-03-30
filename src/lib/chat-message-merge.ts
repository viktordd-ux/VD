import type { MessageDto } from "@/lib/message-serialize";
import { normalizeCreatedAt } from "@/lib/message-normalize";

/** Единый порядок: только normalizeCreatedAt; при равенстве — id. */
export function sortMessagesStable(list: MessageDto[]): MessageDto[] {
  return [...list].sort((a, b) => {
    const na = normalizeCreatedAt(a.createdAt) - normalizeCreatedAt(b.createdAt);
    if (na !== 0) return na;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Map по id → дедуп → финальная сортировка по createdAt.
 */
export function mergeMessages(
  prev: MessageDto[],
  incoming: MessageDto | MessageDto[],
): MessageDto[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  const batch = Array.isArray(incoming) ? incoming : [incoming];
  for (const m of batch) {
    map.set(m.id, m);
  }
  return sortMessagesStable(Array.from(map.values()));
}

export function removeMessageById(prev: MessageDto[], id: string): MessageDto[] {
  const map = new Map(prev.map((m) => [m.id, m]));
  map.delete(id);
  return sortMessagesStable(Array.from(map.values()));
}
