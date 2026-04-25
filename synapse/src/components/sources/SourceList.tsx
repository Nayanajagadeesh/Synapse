"use client";

import { useEffect, useState } from "react";
import { FileText, Globe, Youtube, Rss, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { relativeTime, truncate } from "@/lib/utils";
import { AddSourceMenu } from "./AddSourceMenu";
import type { Source } from "@/types/domain";

interface Props {
  notebookId: string;
  initialSources: Source[];
  variant?: "compact" | "full";
}

const ICONS = {
  pdf: FileText,
  docx: FileText,
  txt: FileText,
  url: Globe,
  youtube: Youtube,
  rss: Rss,
} as const;

export function SourceList({ notebookId, initialSources, variant = "compact" }: Props) {
  const [sources, setSources] = useState<Source[]>(initialSources);

  // Realtime: pick up new sources + status transitions live.
  useEffect(() => {
    const supa = createSupabaseBrowserClient();
    const channel = supa
      .channel(`sources:${notebookId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sources", filter: `notebook_id=eq.${notebookId}` },
        (payload) => {
          setSources((prev) => {
            if (payload.eventType === "INSERT") return [payload.new as Source, ...prev];
            if (payload.eventType === "UPDATE") {
              return prev.map((s) =>
                s.id === (payload.new as Source).id ? (payload.new as Source) : s
              );
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((s) => s.id !== (payload.old as Source).id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supa.removeChannel(channel);
    };
  }, [notebookId]);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Sources <span className="text-muted-foreground">({sources.length})</span></h2>
        <AddSourceMenu notebookId={notebookId} />
      </div>

      {sources.length === 0 && (
        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          Add a PDF, URL, YouTube link, or RSS feed to get started.
        </div>
      )}

      <ul className="space-y-1">
        {sources.map((s) => {
          const Icon = ICONS[s.kind] ?? FileText;
          return (
            <li
              key={s.id}
              className="rounded-md border bg-card p-2 flex items-start gap-2 text-sm"
            >
              <Icon className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{truncate(s.title, 60)}</span>
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {s.kind.toUpperCase()} · {relativeTime(s.created_at)}
                </p>
                {variant === "full" && s.error && (
                  <p className="text-[11px] text-destructive mt-1">{s.error}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: Source["status"] }) {
  if (status === "ready")
    return <CheckCircle2 className="size-3.5 text-emerald-500" aria-label="Ready" />;
  if (status === "error")
    return <AlertTriangle className="size-3.5 text-destructive" aria-label="Error" />;
  return <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Processing" />;
}
