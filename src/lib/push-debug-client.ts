/** Клиент: `NEXT_PUBLIC_PUSH_DEBUG=1` — console.log по SW и подписке. */

export function isPushDebugClient(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env.NEXT_PUBLIC_PUSH_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function pushLogClient(...args: unknown[]): void {
  if (isPushDebugClient()) console.log("[push-debug]", new Date().toISOString(), ...args);
}
