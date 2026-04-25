/**
 * Server-side Supabase client for App Router server components and route handlers.
 * Threads cookies through so RLS sees the authenticated user.
 */

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Components can't set cookies — Next will set them on the
            // route handler / server action that called us.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {}
        },
      },
    }
  );
}

/** Convenience: get the current user or null. */
export async function getCurrentUser() {
  const supa = createSupabaseServerClient();
  const { data } = await supa.auth.getUser();
  return data.user;
}
