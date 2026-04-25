"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, BookOpen, Brain, GraduationCap, FlaskConical, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Note } from "@/types/domain";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  notebookId: string;
  initialNotes: Note[];
  sources: { id: string; title: string }[];
}

const MODE_ICONS: Record<string, any> = {
  summary: BookOpen,
  outline: BookOpen,
  eli5: Brain,
  exam: GraduationCap,
  research: FlaskConical,
  insight: Lightbulb,
};

export function NotesPanel({ notebookId, initialNotes, sources }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [tab, setTab] = useState("notes");
  const [busyMode, setBusyMode] = useState<string | null>(null);
  const [busyInsights, setBusyInsights] = useState(false);
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? "");
  const [mode, setMode] = useState("summary");

  async function generate() {
    if (!sourceId) return;
    setBusyMode(mode);
    try {
      const r = await fetch("/api/notes/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, mode }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed");
      // Reload the notes list so the new one appears at the top.
      const fresh = await fetch(`/api/notes?notebookId=${notebookId}`).catch(() => null);
      if (fresh && fresh.ok) setNotes((await fresh.json()).notes ?? notes);
      toast.success("Generated");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyMode(null);
    }
  }

  async function generateInsights() {
    setBusyInsights(true);
    try {
      const r = await fetch("/api/notes/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed");
      toast.success("Insights generated");
      const fresh = await fetch(`/api/notes?notebookId=${notebookId}`).catch(() => null);
      if (fresh && fresh.ok) setNotes((await fresh.json()).notes ?? notes);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyInsights(false);
    }
  }

  return (
    <div className="px-8 py-6 max-w-4xl mx-auto w-full">
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="notes">All notes</TabsTrigger>
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="notes" className="space-y-3">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No notes yet. Use the <strong>Generate</strong> tab to create one.
            </p>
          )}
          {notes.map((n) => {
            const Icon = MODE_ICONS[n.kind] ?? Sparkles;
            return (
              <article key={n.id} className="rounded-xl border bg-card p-5">
                <header className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="size-4 text-accent" />
                    <span className="font-medium">{n.title ?? n.kind}</span>
                    <span className="text-xs text-muted-foreground">· {n.kind}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{relativeTime(n.created_at)}</span>
                </header>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.content}</ReactMarkdown>
                </div>
              </article>
            );
          })}
        </TabsContent>

        <TabsContent value="generate" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Generate structured notes for any single source.
          </p>
          <div className="flex gap-2 items-center">
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="w-[260px]"><SelectValue placeholder="Choose source" /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary</SelectItem>
                <SelectItem value="outline">Outline / mind-map</SelectItem>
                <SelectItem value="eli5">Explain like I'm 5</SelectItem>
                <SelectItem value="exam">Exam mode</SelectItem>
                <SelectItem value="research">Research mode</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={generate} disabled={!sourceId || !!busyMode} variant="accent">
              {busyMode ? <Loader2 className="size-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pull cross-document trends, contradictions, and key insights from every source in this notebook.
          </p>
          <Button onClick={generateInsights} disabled={busyInsights} variant="accent">
            {busyInsights ? <Loader2 className="size-4 animate-spin mr-2" /> : <Lightbulb className="size-4 mr-2" />}
            Generate insights
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
