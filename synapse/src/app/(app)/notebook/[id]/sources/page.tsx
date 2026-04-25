import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SourceList } from "@/components/sources/SourceList";
import { NotebookTabs } from "@/components/notebooks/NotebookTabs";

export const dynamic = "force-dynamic";

interface Props { params: { id: string } }

export default async function SourcesPage({ params }: Props) {
  const supa = createSupabaseServerClient();
  const { data: notebook } = await supa.from("notebooks").select("title").eq("id", params.id).single();
  const { data: sources } = await supa
    .from("sources")
    .select("*")
    .eq("notebook_id", params.id)
    .order("created_at", { ascending: false });

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <NotebookTabs notebookId={params.id} active="sources" notebookTitle={notebook?.title ?? ""} />
      <div className="overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
        <h2 className="text-lg font-medium mb-4">Sources</h2>
        <SourceList notebookId={params.id} initialSources={sources ?? []} variant="full" />
      </div>
    </div>
  );
}
