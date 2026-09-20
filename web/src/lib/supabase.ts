/**
 * Supabase — GPS routes and run history.
 *
 * The division of labour: the CHAIN holds distance, participation, the pool
 * and the badges (money and reputation live there). Supabase holds only the
 * route polyline and run details — writing thousands of GPS points to chain
 * would be both pointless and expensive.
 *
 * The client is created LAZILY: rather than throwing while the module loads,
 * it raises a clear error at the call site when configuration is missing. That
 * way the app still builds without Supabase and every chain-backed feature
 * keeps working.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Are the run-history features available? */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY are required. Run history is disabled; " +
        "chain-backed features are unaffected.",
    );
  }
  if (!client) client = createClient(url!, anonKey!);
  return client;
}

/**
 * The Supabase client. A `supabase.from(...)` call raises a clear error when
 * unconfigured, rather than silently returning wrong data.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = c[prop as keyof SupabaseClient];
    return typeof value === "function" ? value.bind(c) : value;
  },
});
