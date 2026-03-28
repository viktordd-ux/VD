export function orderPushUrlForAdmin(orderId: string): string {
  return `/admin/orders/${orderId}`;
}

export function orderPushUrlForExecutor(orderId: string): string {
  return `/executor/orders/${orderId}`;
}
