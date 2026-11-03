import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SECRET key (bypasses RLS). Never import this from a client component and
// never expose the key via NEXT_PUBLIC_*: all tables have RLS on with no policies, so this is the only way in.
let client: SupabaseClient | undefined;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set");
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
