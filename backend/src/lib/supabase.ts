import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

/**
 * Server-side Supabase clients for the Express API.
 * `@supabase/ssr` is installed for a future Next.js app (cookie-based sessions); this backend uses `supabase-js` only.
 */

function assertUrl(url: string | undefined): url is string {
  return Boolean(url && /^https?:\/\//.test(url));
}

/** RLS-respecting client (anon / publishable key). Returns null if env not configured. */
export function getSupabaseAnonClient(): SupabaseClient | null {
  if (!assertUrl(env.SUPABASE_URL) || !env.SUPABASE_ANON_KEY) {
    return null;
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/** Admin client (service role). Bypasses RLS — use only for trusted server paths. Returns null if not configured. */
export function getSupabaseServiceRoleClient(): SupabaseClient | null {
  if (!assertUrl(env.SUPABASE_URL) || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
