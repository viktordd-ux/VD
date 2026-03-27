import type {
  CheckpointStatus,
  LeadStatus,
  OrderStatus,
  UserStatus,
} from "@prisma/client";

/** Подписи статусов заказа (enum → русский UI). */
export const orderStatusLabel: Record<OrderStatus, string> = {
  LEAD: "Лид",
  IN_PROGRESS: "В работе",
  REVIEW: "На проверке",
  DONE: "Завершён",
};

/** Подписи статусов лида. */
export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW: "Новый",
  IN_CHAT: "В переписке",
  WON: "Выигран",
  LOST: "Проигран",
};

/** Подписи статусов этапа. */
export const checkpointStatusLabel: Record<CheckpointStatus, string> = {
  pending: "Ожидает",
  done: "Готово",
};

/** Статус пользователя в UI. */
export const userStatusLabel: Record<UserStatus, string> = {
  active: "Активен",
  banned: "Заблокирован",
};

/** Роль в UI. */
export function userRoleLabel(role: string): string {
  if (role === "admin") return "Администратор";
  if (role === "executor") return "Исполнитель";
  return role;
}

/** Тип сущности в журнале (audit). */
export function auditEntityLabel(entityType: string): string {
  const map: Record<string, string> = {
    order: "Заказ",
    checkpoint: "Этап",
    lead: "Лид",
    user: "Пользователь",
    file: "Файл",
    order_template: "Шаблон",
  };
  return map[entityType] ?? entityType;
}

/** Действие в журнале (audit). */
export function auditActionLabel(actionType: string): string {
  const map: Record<string, string> = {
    create: "Создание",
    update: "Изменение",
    delete: "Удаление",
    upload: "Загрузка файла",
    convert_to_order: "Конвертация в заказ",
    create_from_lead: "Создание из лида",
    executor_submit: "Сдача на проверку",
    executor_update: "Изменение (исполнитель)",
    auto_assign_executor: "Автоназначение исполнителя",
    auto_all_checkpoints_done: "Все этапы завершены автоматически",
    change_password: "Смена пароля",
    reset_password: "Сброс пароля",
    create_user: "Создание пользователя",
  };
  return map[actionType] ?? actionType;
}
