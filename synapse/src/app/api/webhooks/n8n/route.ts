/**
 * POST /api/webhooks/n8n
 *
 * n8n posts here when one of its workflows finishes. We authenticate via a
 * shared secret in the `X-Synapse-Secret` header (configured in docker-compose
 * and mirrored in .env via N8N_WEBHOOK_SECRET).
 *
 * Supported events:
 *   { event: "agent.findings", agent_id, content, citations? }
 *   { event: "source.refresh", source_id }
 *   { event: "rss.sync",       source_id }
 */

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ingestSource } from "@/lib/rag/ingest";
import { syncFeed } from "@/lib/ingest/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("agent.findings"),
    agent_id: z.string().uuid(),
    content: z.string().min(1),
  }),
  z.object({
    event: z.literal("source.refresh"),
    source_id: z.string().uuid(),
  }),
  z.object({
    event: z.literal("rss.sync"),
    source_id: z.string().uuid(),
  }),
]);

export async function POST(req: Request) {
  const secret = req.headers.get("x-synapse-secret");
  if (!secret || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: z.infer<typeof Schema>;
  try {
    payload = Schema.parse(await req.json());
  } catch (e: any) {
    return Response.json({ error: "Bad payload", detail: e?.message }, { status: 400 });
  }

  const supa = supabaseAdmin();

  switch (payload.event) {
    case "agent.findings": {
      const { data: agent } = await supa
        .from("agents")
        .select("notebook_id,name")
        .eq("id", payload.agent_id)
        .single();
      if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });

      await supa.from("notes").insert({
        notebook_id: agent.notebook_id,
        kind: "insight",
        title: `Agent (n8n) – ${agent.name}`,
        content: payload.content,
        metadata: { agent_id: payload.agent_id, via: "n8n" },
      });
      await supa
        .from("agents")
        .update({ status: "idle", last_run_at: new Date().toISOString() })
        .eq("id", payload.agent_id);
      return Response.json({ ok: true });
    }

    case "source.refresh": {
      await ingestSource({ sourceId: payload.source_id });
      return Response.json({ ok: true });
    }

    case "rss.sync": {
      const added = await syncFeed(payload.source_id);
      return Response.json({ ok: true, added });
    }
  }
}
