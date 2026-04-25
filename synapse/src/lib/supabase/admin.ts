/**
 * Service-role Supabase client. ONLY use this in server code (API routes,
 * server actions, n8n callbacks). It bypasses RLS, so always perform an
 * explicit auth/permission check before touching another user's data.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let _admin: ReturnType<typeof createClient<Database>> | null = null;

export function supabaseAdmin() {
  if (_admin) return _admin;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  _admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
  return _admin;
}
