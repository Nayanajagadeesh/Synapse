/**
 * Browser-side Supabase client for use inside Client Components.
 * Reads from the `NEXT_PUBLIC_*` env vars and persists session in cookies
 * via `@supabase/ssr` so server components see the same auth state.
 */

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
