/**
 * Auth helpers for API routes. We always re-check session in the route — never
 * trust the client — and additionally verify membership for notebook-scoped ops.
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export class AuthError extends Error {
  constructor(message: string, public status = 401) { super(message); }
}
export class ForbiddenError extends Error {
  constructor(message = "Forbidden") { super(message); }
}

export async function requireUser() {
  const supa = createSupabaseServerClient();
  const { data, error } = await supa.auth.getUser();
  if (error || !data.user) throw new AuthError("Not authenticated");
  return data.user;
}

export async function requireNotebookRole(
  notebookId: string,
  allowed: ("viewer" | "editor" | "admin")[]
): Promise<{ userId: string; role: "viewer" | "editor" | "admin" }> {
  const user = await requireUser();
  const supa = supabaseAdmin();
  const { data, error } = await supa.rpc("notebook_role_for", {
    target: notebookId,
    uid: user.id,
  });
  if (error) throw error;
  const role = data as "viewer" | "editor" | "admin" | null;
  if (!role || !allowed.includes(role)) throw new ForbiddenError();
  return { userId: user.id, role };
}

/** Convert thrown errors into clean JSON responses. */
export function errorToResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ForbiddenError) {
    return Response.json({ error: err.message }, { status: 403 });
  }
  console.error("[api] unhandled error", err);
  const message = err instanceof Error ? err.message : "Internal error";
  return Response.json({ error: message }, { status: 500 });
}
