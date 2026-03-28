/**
 * Единая бизнес-логика непрочитанных состояний по заказу (чат и «проект»).
 * Все сравнения lastActivity vs readAt — только здесь.
 */

export type OrderUserReadStateInput = {
  chatReadAt: Date | null;
  projectReadAt: Date | null;
};

export type OrderUnreadFlags = {
  hasUnreadChat: boolean;
  hasUnreadProject: boolean;
  /** true, если непрочитан чат и/или проект */
  hasUnreadAny: boolean;
};

export type OrderUnreadBatchRow = OrderUnreadFlags & {
  orderId: string;
};

export type OrderUnreadGlobalSummary = {
  hasAnyUnreadChats: boolean;
};

function maxDate(dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (!d) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

/**
 * Единое сравнение для чата и проекта: есть ли активность после отметки «прочитано».
 */
export function isUnread(
  lastActivityAt: Date | null | undefined,
  readAt: Date | null | undefined,
): boolean {
  if (lastActivityAt == null) return false;
  if (readAt == null) return true;
  return lastActivityAt.getTime() > readAt.getTime();
}

/**
 * Агрегат «последняя активность по проекту» (поля заказа, файлы, этапы).
 */
export function projectLastActivityAt(params: {
  orderUpdatedAt: Date;
  filesMaxCreatedAt: Date | null | undefined;
  checkpointsMaxUpdatedAt: Date | null | undefined;
}): Date | null {
  return maxDate([
    params.orderUpdatedAt,
    params.filesMaxCreatedAt ?? null,
    params.checkpointsMaxUpdatedAt ?? null,
  ]);
}

export type OrderUnreadComputationInput = {
  /** max(created_at) сообщений от других участников (не текущего пользователя) */
  chatLastActivityAt: Date | null;
  projectLastActivityAt: Date | null;
  read: OrderUserReadStateInput;
};

export function computeOrderUnreadFlags(
  input: OrderUnreadComputationInput,
): OrderUnreadFlags {
  const hasUnreadChat = isUnread(input.chatLastActivityAt, input.read.chatReadAt);
  const hasUnreadProject = isUnread(
    input.projectLastActivityAt,
    input.read.projectReadAt,
  );
  return {
    hasUnreadChat,
    hasUnreadProject,
    hasUnreadAny: hasUnreadChat || hasUnreadProject,
  };
}
