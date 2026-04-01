const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp|heic|heif)$/i;

/** Без mime на сервере — эвристика по имени файла (как в мессенджерах). */
export function isProbablyChatImageFileName(name: string): boolean {
  return IMAGE_EXT.test(name.trim());
}
