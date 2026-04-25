import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotesPanel } from "@/components/notes/NotesPanel";
import { NotebookTabs } from "@/components/notebooks/NotebookTabs";

export const dynamic = "force-dynamic";

interface Props { params: { id: string } }

export default async function NotesPage({ params }: Props) {
  const supa = createSupabaseServerClient();
  const [{ data: notebook }, { data: notes }, { data: sources }] = await Promise.all([
    supa.from("notebooks").select("title").eq("id", params.id).single(),
    supa
      .from("notes")
      .select("*")
      .eq("notebook_id", params.id)
      .order("created_at", { ascending: false }),
    supa.from("sources").select("id,title").eq("notebook_id", params.id),
  ]);

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <NotebookTabs notebookId={params.id} active="notes" notebookTitle={notebook?.title ?? ""} />
      <div className="overflow-y-auto">
        <NotesPanel
          notebookId={params.id}
          initialNotes={notes ?? []}
          sources={sources ?? []}
        />
      </div>
    </div>
  );
}
