import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { SourceList } from "@/components/sources/SourceList";
import { NotebookTabs } from "@/components/notebooks/NotebookTabs";

export const dynamic = "force-dynamic";

interface Props { params: { id: string } }

export default async function NotebookHome({ params }: Props) {
  const supa = createSupabaseServerClient();
  const { data: notebook, error } = await supa
    .from("notebooks")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) redirect("/dashboard");
  if (!notebook) notFound();

  const [{ data: sources }, { data: messages }] = await Promise.all([
    supa
      .from("sources")
      .select("*")
      .eq("notebook_id", params.id)
      .order("created_at", { ascending: false }),
    supa
      .from("messages")
      .select("*")
      .eq("notebook_id", params.id)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <NotebookTabs notebookId={params.id} active="chat" notebookTitle={notebook.title} />
      <div className="grid grid-cols-[320px_1fr] h-full overflow-hidden">
        <aside className="border-r overflow-y-auto">
          <SourceList notebookId={params.id} initialSources={sources ?? []} />
        </aside>
        <section className="overflow-hidden">
          <ChatPanel notebookId={params.id} initialMessages={messages ?? []} />
        </section>
      </div>
    </div>
  );
}
