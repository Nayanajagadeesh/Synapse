import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotebookSidebar } from "@/components/notebooks/NotebookSidebar";
import { TopBar } from "@/components/notebooks/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supa = createSupabaseServerClient();
  const { data: notebooks } = await supa
    .from("notebooks")
    .select("id,title,emoji,updated_at")
    .order("updated_at", { ascending: false });
  const { data: profile } = await supa
    .from("profiles")
    .select("display_name,email,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="h-dvh grid grid-cols-[260px_1fr] grid-rows-[56px_1fr]">
      <div className="row-span-2 border-r bg-card/30 overflow-y-auto">
        <NotebookSidebar notebooks={notebooks ?? []} />
      </div>
      <div className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <TopBar profile={profile ?? undefined} />
      </div>
      <main className="overflow-hidden bg-background">{children}</main>
    </div>
  );
}
