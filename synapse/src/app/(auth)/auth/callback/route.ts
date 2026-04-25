/**
 * OAuth & magic-link callback. Supabase redirects here with `?code=…`; we
 * exchange it for a session, then bounce the user to /dashboard.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  if (code) {
    const supa = createSupabaseServerClient();
    await supa.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
