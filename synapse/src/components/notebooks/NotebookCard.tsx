import { relativeTime } from "@/lib/utils";

interface Props {
  notebook: { id: string; title: string; emoji: string | null; description: string | null; updated_at: string };
}

export function NotebookCard({ notebook }: Props) {
  return (
    <div className="rounded-xl border bg-card p-5 hover:border-accent/40 hover:shadow-sm transition-all h-full">
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none">{notebook.emoji ?? "📓"}</div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold truncate">{notebook.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Updated {relativeTime(notebook.updated_at)}
          </p>
        </div>
      </div>
      {notebook.description && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{notebook.description}</p>
      )}
    </div>
  );
}
