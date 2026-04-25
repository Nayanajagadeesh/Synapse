/** POST /api/notes/insights  { notebookId } — cross-document trends/contradictions/insights */

import { z } from "zod";
import { errorToResponse, requireNotebookRole } from "@/lib/auth";
import { generateInsights } from "@/lib/insights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Schema = z.object({ notebookId: z.string().uuid() });

export async function POST(req: Request) {
  try {
    const { notebookId } = Schema.parse(await req.json());
    await requireNotebookRole(notebookId, ["editor", "admin"]);
    const content = await generateInsights({ notebookId });
    return Response.json({ content });
  } catch (e) {
    return errorToResponse(e);
  }
}
