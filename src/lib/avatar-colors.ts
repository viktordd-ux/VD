/** Стабильный «хэш» строки → индекс палитры (для аватаров без фото). */
export function avatarColorIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 8;
}

/** Классы Tailwind: фон + текст для контраста. */
export const AVATAR_PALETTE = [
  "bg-violet-500/90 text-white",
  "bg-sky-500/90 text-white",
  "bg-emerald-500/90 text-white",
  "bg-amber-500/90 text-white",
  "bg-rose-500/90 text-white",
  "bg-cyan-600/90 text-white",
  "bg-fuchsia-500/90 text-white",
  "bg-indigo-500/90 text-white",
] as const;
