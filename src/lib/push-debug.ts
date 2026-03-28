/** Сервер: `PUSH_DEBUG=1` или `true` — подробные логи push в stdout (Vercel / локально). */
export function isPushDebugServer(): boolean {
  const v = process.env.PUSH_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function pushLogServer(...args: unknown[]): void {
  if (!isPushDebugServer()) return;
  console.log("[push]", new Date().toISOString(), ...args);
}

/** Короткий отпечаток публичного VAPID (для сверки клиент ↔ сервер в логах). */
export function vapidPublicFingerprint(publicKey: string): string {
  const t = publicKey.trim();
  if (t.length <= 16) return t;
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}
