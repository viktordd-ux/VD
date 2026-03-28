import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getPublicUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
}

function getPublicAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
}

export const isSupabaseRealtimeConfigured = () =>
  Boolean(getPublicUrl() && getPublicAnonKey());

let _client: SupabaseClient | null = null;

/** Один браузерный клиент; без URL/anon не создаётся (нет пустых ключей). */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = getPublicUrl();
  const anonKey = getPublicAnonKey();
  if (!url || !anonKey) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}
