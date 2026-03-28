import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram";

async function notifyExecutor(executorId: string | null | undefined, text: string): Promise<void> {
  if (!executorId) return;
  const user = await prisma.user.findUnique({
    where: { id: executorId },
    select: { telegramId: true, role: true },
  });
  if (!user || user.role !== "executor" || !user.telegramId?.trim()) return;
  await sendTelegramMessage(user.telegramId.trim(), text);
}

export function notifyExecutorOrderAssigned(executorId: string | null, orderTitle: string): void {
  void notifyExecutor(executorId, `Тебе назначен заказ: ${orderTitle}`);
}

export function notifyExecutorNewCheckpoint(executorId: string | null, orderTitle: string): void {
  void notifyExecutor(executorId, `Новый чекпоинт в заказе «${orderTitle}»`);
}

export function notifyExecutorChatMessage(executorId: string | null): void {
  void notifyExecutor(executorId, "Новое сообщение в заказе");
}

export function notifyExecutorDeadlineTomorrow(executorId: string | null, orderTitle: string): void {
  void notifyExecutor(executorId, `Дедлайн завтра: «${orderTitle}»`);
}

export function notifyExecutorOrderOverdue(executorId: string | null, orderTitle: string): void {
  void notifyExecutor(executorId, `Заказ просрочен: «${orderTitle}»`);
}
