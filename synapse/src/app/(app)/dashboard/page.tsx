import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NotebookCard } from "@/components/notebooks/NotebookCard";
import { CreateNotebookButton } from "@/components/notebooks/CreateNotebookButton";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const supa = createSupabaseServerClient();
  const { data: notebooks } = await supa
    .from("notebooks")
    .select("id,title,description,emoji,updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="h-full overflow-y-auto px-8 py-10">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Your notebooks</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Each notebook is a separate knowledge base. Add sources, ask questions, share with teammates.
            </p>
          </div>
          <CreateNotebookButton />
        </header>

        {(!notebooks || notebooks.length === 0) && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            No notebooks yet — click <span className="font-medium text-foreground">New notebook</span> to make your first.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(notebooks ?? []).map((n) => (
            <Link key={n.id} href={`/notebook/${n.id}`}>
              <NotebookCard notebook={n} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
