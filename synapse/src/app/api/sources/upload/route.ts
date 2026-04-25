/**
 * POST /api/sources/upload    multipart form upload (PDF / DOCX / TXT)
 *
 * Body: FormData {
 *   notebookId: string,
 *   file: File (≤ 25 MB),
 *   title?: string
 * }
 *
 * Stores the file in the `sources` Storage bucket, creates a `sources` row,
 * and immediately runs the ingestion pipeline (chunk → embed → insert).
 */

import { v4 as uuid } from "uuid";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ingestSource } from "@/lib/rag/ingest";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOWED: Record<string, "pdf" | "docx" | "txt"> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "txt",
};

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const notebookId = String(form.get("notebookId") ?? "");
    const file = form.get("file") as File | null;
    const titleOverride = form.get("title");
    if (!notebookId || !file) {
      return Response.json({ error: "notebookId and file are required" }, { status: 400 });
    }
    const { userId } = await requireNotebookRole(notebookId, ["editor", "admin"]);

    const kind = ALLOWED[file.type] ?? guessFromExt(file.name);
    if (!kind) {
      return Response.json({ error: `Unsupported type: ${file.type}` }, { status: 415 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return Response.json({ error: "File exceeds 25 MB" }, { status: 413 });
    }

    const supa = supabaseAdmin();
    const path = `${notebookId}/${uuid()}-${sanitize(file.name)}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await supa.storage.from("sources").upload(path, arrayBuffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) throw upErr;

    const { data: source, error: insErr } = await supa
      .from("sources")
      .insert({
        notebook_id: notebookId,
        kind,
        title: (typeof titleOverride === "string" && titleOverride) || file.name,
        storage_path: path,
        status: "pending",
        created_by: userId,
      })
      .select("*")
      .single();
    if (insErr) throw insErr;

    // Fire and forget — return 202 immediately; the client polls for status.
    ingestSource({ sourceId: source.id }).catch((e) => console.error("ingest failed", e));
    return Response.json({ source }, { status: 202 });
  } catch (e) {
    return errorToResponse(e);
  }
}

function sanitize(name: string) {
  return name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 80);
}
function guessFromExt(name: string): "pdf" | "docx" | "txt" | null {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (ext === "txt" || ext === "md") return "txt";
  return null;
}
