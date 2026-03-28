import {
  sendPushToAllAdmins,
  sendPushToUser,
} from "@/lib/push-send";
import {
  orderPushUrlForAdmin,
  orderPushUrlForExecutor,
} from "@/lib/push-order-urls";

export function pushNotifyExecutorAssigned(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Вам назначен заказ",
    body: `«${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}

export function pushNotifyExecutorNewCheckpoint(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Новый чекпоинт",
    body: `Заказ «${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}

export function pushNotifyExecutorChatMessage(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Новое сообщение",
    body: `Заказ «${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}

export function pushNotifyAdminsNewChatMessage(orderTitle: string, orderId: string): void {
  void sendPushToAllAdmins({
    title: "Новое сообщение",
    body: `Заказ «${orderTitle}»`,
    url: orderPushUrlForAdmin(orderId),
  });
}

export function pushNotifyAdminsNewFile(orderTitle: string, orderId: string): void {
  void sendPushToAllAdmins({
    title: "Новый файл в заказе",
    body: `«${orderTitle}»`,
    url: orderPushUrlForAdmin(orderId),
  });
}

export function pushNotifyExecutorOrderFile(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Новый файл",
    body: `Заказ «${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}

export function pushNotifyExecutorDeadlineTomorrow(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Дедлайн завтра",
    body: `«${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}

export function pushNotifyExecutorOrderOverdue(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Заказ просрочен",
    body: `«${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}

export function pushNotifyAdminsOrderReview(orderTitle: string, orderId: string): void {
  void sendPushToAllAdmins({
    title: "Сдача на проверку",
    body: `Заказ «${orderTitle}»`,
    url: orderPushUrlForAdmin(orderId),
  });
}

export function pushNotifyAdminsLowMargin(orderTitle: string, orderId: string): void {
  void sendPushToAllAdmins({
    title: "Низкая маржа",
    body: `Заказ «${orderTitle}»`,
    url: orderPushUrlForAdmin(orderId),
  });
}

export function pushNotifyAdminsCheckpointReview(orderTitle: string, orderId: string): void {
  void sendPushToAllAdmins({
    title: "Этап на проверке",
    body: `«${orderTitle}»`,
    url: orderPushUrlForAdmin(orderId),
  });
}

export function pushNotifyExecutorCheckpointAccepted(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Этап принят",
    body: `«${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}

export function pushNotifyAdminsCheckpointsBulk(
  orderTitle: string,
  orderId: string,
  updated: number,
): void {
  void sendPushToAllAdmins({
    title: "Этапы сданы на проверку",
    body: `Заказ «${orderTitle}» — ${updated} этап(ов)`,
    url: orderPushUrlForAdmin(orderId),
  });
}

export function pushNotifyExecutorCheckpointsBulkAccepted(
  executorId: string | null,
  orderTitle: string,
  orderId: string,
): void {
  if (!executorId) return;
  void sendPushToUser(executorId, {
    title: "Все этапы приняты",
    body: `Заказ «${orderTitle}»`,
    url: orderPushUrlForExecutor(orderId),
  });
}
