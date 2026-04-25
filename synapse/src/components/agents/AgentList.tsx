"use client";

import { useState } from "react";
import { Bot, Play, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Agent } from "@/types/domain";
import { relativeTime } from "@/lib/utils";

interface Props {
  notebookId: string;
  initialAgents: Agent[];
}

export function AgentList({ notebookId, initialAgents }: Props) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  async function run(id: string) {
    setRunning(id);
    try {
      const r = await fetch(`/api/agents/${id}/run`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Run failed");
      toast.success("Agent finished — see Notes for findings");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Agents</h2>
          <p className="text-sm text-muted-foreground">
            Saved jobs that fetch, analyse, and notify. Schedules run via n8n; press play for a one-off.
          </p>
        </div>
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-1.5" /> New agent
        </Button>
      </div>

      {agents.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Try: <em>"Track new AI safety papers and summarise daily."</em>
        </div>
      )}

      <ul className="space-y-2">
        {agents.map((a) => (
          <li key={a.id} className="rounded-lg border bg-card p-4 flex items-start gap-3">
            <div className="size-8 rounded-md bg-accent/15 grid place-items-center">
              <Bot className="size-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">
                  {a.schedule_cron ? `cron: ${a.schedule_cron}` : "manual"} · {a.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{a.instructions}</p>
              {a.last_run_at && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Last run: {relativeTime(a.last_run_at)}
                </p>
              )}
              {a.last_error && <p className="text-xs text-destructive mt-1">{a.last_error}</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => run(a.id)} disabled={running === a.id}>
              {running === a.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            </Button>
          </li>
        ))}
      </ul>

      <CreateAgentDialog
        notebookId={notebookId}
        open={open}
        onOpenChange={setOpen}
        onCreated={(a) => setAgents((prev) => [a, ...prev])}
      />
    </div>
  );
}

function CreateAgentDialog({
  notebookId,
  open,
  onOpenChange,
  onCreated,
}: {
  notebookId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (a: Agent) => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [schedule, setSchedule] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, name, instructions, schedule_cron: schedule || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed");
      onCreated(j.agent);
      toast.success("Agent created");
      onOpenChange(false);
      setName(""); setInstructions(""); setSchedule("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create an agent</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input placeholder="Name (e.g. Daily AI digest)" value={name} onChange={(e) => setName(e.target.value)} required />
          <Textarea
            placeholder="Instructions: e.g. Track new LLM safety papers and summarise the most important findings."
            value={instructions} onChange={(e) => setInstructions(e.target.value)} required rows={4}
          />
          <Input placeholder="Cron (optional, e.g. 0 9 * * *)" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          <Button type="submit" variant="accent" disabled={busy} className="w-full">
            {busy ? "Creating..." : "Create agent"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
