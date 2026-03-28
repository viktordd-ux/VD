import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Слияние props с сервера и NEXT_PUBLIC_* (на Vercel клиентский бандл часто без env — props обязательны для Realtime). */
export function resolveSupabasePublicEnv(
  supabaseUrl?: string,
  supabaseAnonKey?: string,
): { url: string; anonKey: string } {
  const url = (supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  return { url, anonKey };
}

export const isSupabaseRealtimeConfigured = (
  supabaseUrl?: string,
  supabaseAnonKey?: string,
) => {
  const { url, anonKey } = resolveSupabasePublicEnv(supabaseUrl, supabaseAnonKey);
  return Boolean(url && anonKey);
};

let _client: SupabaseClient | null = null;
let _clientKey: string | null = null;

export type SupabaseBrowserClientOptions = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

/**
 * Один экземпляр на пару URL+anon (переиспользование WebSocket).
 * Передавайте props с server component, если в браузере пустой NEXT_PUBLIC_*.
 */
export function getSupabaseBrowserClient(
  opts?: SupabaseBrowserClientOptions,
): SupabaseClient | null {
  const { url, anonKey } = resolveSupabasePublicEnv(
    opts?.supabaseUrl,
    opts?.supabaseAnonKey,
  );
  if (!url || !anonKey) return null;
  const key = `${url}\0${anonKey}`;
  if (_clientKey !== key || !_client) {
    _client = createClient(url, anonKey);
    _clientKey = key;
  }
  return _client;
}
