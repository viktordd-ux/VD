const CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Случайный пароль из латинских букв и цифр.
 * @param length длина 8–12 (по умолчанию 10)
 */
export function generatePassword(length = 10): string {
  const len = Math.min(12, Math.max(8, Math.floor(length)));
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CHARSET[bytes[i]! % CHARSET.length];
  }
  return out;
}
