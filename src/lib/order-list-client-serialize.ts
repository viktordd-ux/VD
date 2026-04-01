import { Prisma } from "@prisma/client";
import type { Checkpoint, File, Order, User } from "@prisma/client";
import { getOrderExecutorUserIds } from "@/lib/order-executors";
import type { OrderWithRelations } from "@/lib/order-list-filters";

export type SerializedUser = Omit<User, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export function serializeUserForList(u: User | null): SerializedUser | null {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    passwordHash: u.passwordHash,
    role: u.role,
    status: u.status,
    phone: u.phone,
    telegram: u.telegram,
    telegramId: u.telegramId,
    skills: u.skills,
    primarySkill: u.primarySkill,
    onboarded: u.onboarded,
    pushEnabled: u.pushEnabled,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

export function hydrateUserFromList(u: SerializedUser | null): User | null {
  if (!u) return null;
  return {
    ...u,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
  };
}

export type SerializedOrderWithRelations = Omit<
  OrderWithRelations,
  | "budgetClient"
  | "budgetExecutor"
  | "profit"
  | "deadline"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "executor"
  | "checkpoints"
  | "files"
> & {
  budgetClient: string;
  budgetExecutor: string;
  profit: string;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  executor: SerializedUser | null;
  checkpoints: Array<
    Omit<Checkpoint, "paymentAmount" | "dueDate" | "payoutReleasedAt" | "createdAt" | "updatedAt"> & {
      paymentAmount: string;
      dueDate: string | null;
      payoutReleasedAt: string | null;
      createdAt: string;
      updatedAt: string;
    }
  >;
  files: Array<
    Omit<File, "createdAt"> & {
      createdAt: string;
    }
  >;
  executorUserIds?: string[];
  team?: { id: string; name: string } | null;
};

/** Список «Мои задачи» — без чекпоинтов/файлов до первого merge по realtime. */
export function serializeExecutorHomeOrders(
  orders: (Order & { orderExecutors?: { userId: string }[] })[],
): SerializedOrderWithRelations[] {
  return orders.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    clientName: o.clientName,
    platform: o.platform,
    deadline: o.deadline?.toISOString() ?? null,
    budgetClient: o.budgetClient.toString(),
    budgetExecutor: o.budgetExecutor.toString(),
    profit: o.profit.toString(),
    status: o.status,
    organizationId: o.organizationId,
    teamId: o.teamId,
    executorId: o.executorId,
    leadId: o.leadId,
    revisionCount: o.revisionCount,
    requiredSkills: o.requiredSkills,
    templateId: o.templateId,
    deletedAt: o.deletedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    checkpoints: [],
    files: [],
    executor: null,
    executorUserIds: getOrderExecutorUserIds(o),
    team: null,
  }));
}

export function serializeOrdersForListClient(
  orders: OrderWithRelations[],
): SerializedOrderWithRelations[] {
  return orders.map((o) => ({
    id: o.id,
    title: o.title,
    description: o.description,
    clientName: o.clientName,
    platform: o.platform,
    deadline: o.deadline?.toISOString() ?? null,
    budgetClient: o.budgetClient.toString(),
    budgetExecutor: o.budgetExecutor.toString(),
    profit: o.profit.toString(),
    status: o.status,
    organizationId: o.organizationId,
    teamId: o.teamId,
    executorId: o.executorId,
    leadId: o.leadId,
    revisionCount: o.revisionCount,
    requiredSkills: o.requiredSkills,
    templateId: o.templateId,
    deletedAt: o.deletedAt?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    executor: serializeUserForList(o.executor),
    checkpoints: o.checkpoints.map((c) => ({
      id: c.id,
      orderId: c.orderId,
      title: c.title,
      status: c.status,
      dueDate: c.dueDate?.toISOString() ?? null,
      paymentAmount: c.paymentAmount.toString(),
      payoutReleasedAt: c.payoutReleasedAt?.toISOString() ?? null,
      position: c.position,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    files: o.files.map((f) => ({
      id: f.id,
      orderId: f.orderId,
      uploadedBy: f.uploadedBy,
      kind: f.kind,
      filePath: f.filePath,
      externalUrl: f.externalUrl,
      linkTitle: f.linkTitle,
      comment: f.comment,
      createdAt: f.createdAt.toISOString(),
    })),
    executorUserIds: getOrderExecutorUserIds(o),
    team: o.team ?? null,
  }));
}

export function hydrateOrderWithRelations(
  o: SerializedOrderWithRelations,
): OrderWithRelations {
  return {
    ...o,
    budgetClient: new Prisma.Decimal(o.budgetClient),
    budgetExecutor: new Prisma.Decimal(o.budgetExecutor),
    profit: new Prisma.Decimal(o.profit),
    deadline: o.deadline ? new Date(o.deadline) : null,
    createdAt: new Date(o.createdAt),
    updatedAt: new Date(o.updatedAt),
    deletedAt: o.deletedAt ? new Date(o.deletedAt) : null,
    executor: hydrateUserFromList(o.executor),
    checkpoints: o.checkpoints.map((c) => ({
      ...c,
      paymentAmount: new Prisma.Decimal(c.paymentAmount),
      dueDate: c.dueDate ? new Date(c.dueDate) : null,
      payoutReleasedAt: c.payoutReleasedAt ? new Date(c.payoutReleasedAt) : null,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt),
    })),
    files: o.files.map((f) => ({
      ...f,
      createdAt: new Date(f.createdAt),
    })),
  };
}
