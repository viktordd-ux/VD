import { revalidatePath } from "next/cache";

/** Инвалидация кеша маршрутов после мутаций заказа (RSC + router.refresh). */
export function revalidateOrderViews(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/risks");
  revalidatePath("/executor");
  revalidatePath(`/executor/orders/${orderId}`);
}

export function revalidateAdminUsers(userId?: string) {
  revalidatePath("/admin/users");
  if (userId) revalidatePath(`/admin/users/${userId}`);
}

export function revalidateAdminLeads() {
  revalidatePath("/admin/leads");
}

export function revalidateAdminFinance() {
  revalidatePath("/admin/finance");
}

export function revalidateAdminBulk() {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/finance");
}
