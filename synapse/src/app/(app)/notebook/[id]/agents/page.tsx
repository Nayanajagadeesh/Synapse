import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AgentList } from "@/components/agents/AgentList";
import { NotebookTabs } from "@/components/notebooks/NotebookTabs";

export const dynamic = "force-dynamic";

interface Props { params: { id: string } }

export default async function AgentsPage({ params }: Props) {
  const supa = createSupabaseServerClient();
  const [{ data: notebook }, { data: agents }] = await Promise.all([
    supa.from("notebooks").select("title").eq("id", params.id).single(),
    supa.from("agents").select("*").eq("notebook_id", params.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <NotebookTabs notebookId={params.id} active="agents" notebookTitle={notebook?.title ?? ""} />
      <div className="overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
        <AgentList notebookId={params.id} initialAgents={agents ?? []} />
      </div>
    </div>
  );
}
