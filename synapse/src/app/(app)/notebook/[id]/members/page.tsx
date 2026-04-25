import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MembersPanel } from "@/components/members/MembersPanel";
import { NotebookTabs } from "@/components/notebooks/NotebookTabs";

export const dynamic = "force-dynamic";

interface Props { params: { id: string } }

export default async function MembersPage({ params }: Props) {
  const supa = createSupabaseServerClient();
  const { data: notebook } = await supa.from("notebooks").select("title,owner_id").eq("id", params.id).single();
  const { data: members } = await supa
    .from("notebook_members")
    .select("user_id,role,profiles:user_id(email,display_name,avatar_url)")
    .eq("notebook_id", params.id);

  return (
    <div className="h-full grid grid-rows-[auto_1fr]">
      <NotebookTabs notebookId={params.id} active="members" notebookTitle={notebook?.title ?? ""} />
      <div className="overflow-y-auto px-8 py-6 max-w-3xl mx-auto w-full">
        <MembersPanel notebookId={params.id} initialMembers={(members as any) ?? []} />
      </div>
    </div>
  );
}
