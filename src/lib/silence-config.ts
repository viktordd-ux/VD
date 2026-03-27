function parseDays(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

/** Пороги «тишины» исполнителя (дни). Предупреждение ниже порога высокого риска. */
export function getSilenceThresholds(): {
  warningDays: number;
  highDays: number;
} {
  const warningDays = parseDays(process.env.SILENCE_WARNING_DAYS, 3);
  const highDays = parseDays(process.env.SILENCE_HIGH_DAYS, 7);
  return {
    warningDays: Math.min(warningDays, highDays),
    highDays: Math.max(warningDays, highDays),
  };
}
