import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseRealtimeConfigured = () =>
  Boolean(url && anonKey);

let _client: SupabaseClient | null = null;

/** Один браузерный клиент; без URL/anon не создаётся (нет пустых ключей). */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!_client) _client = createClient(url, anonKey);
  return _client;
}
