import { buildGraph } from "@/lib/graph";
import { KnowledgeGraph } from "@/components/graph/KnowledgeGraph";
import { NotebookTabs } from "@/components/notebooks/NotebookTabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Props { params: { id: string } }

export default async function GraphPage({ params }: Props) {
  const supa = createSupabaseServerClient();
  const { data: notebook } = await supa.from("notebooks").select("title").eq("id", params.id).single();
  const data = await buildGraph(params.id);

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <NotebookTabs notebookId={params.id} active="graph" notebookTitle={notebook?.title ?? ""} />
      <div className="relative overflow-hidden">
        <KnowledgeGraph data={data} />
      </div>
    </div>
  );
}
