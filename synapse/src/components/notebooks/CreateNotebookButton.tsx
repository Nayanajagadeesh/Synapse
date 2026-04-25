"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CreateNotebookButton({ variant = "primary" }: { variant?: "primary" | "sidebar" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("📓");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/notebooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, emoji, description }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Failed");
      toast.success("Notebook created");
      setOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/notebook/${json.notebook.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "sidebar" ? (
          <button className="flex items-center gap-2 mx-1 mt-1 px-2 h-9 text-sm rounded-md border border-dashed hover:bg-muted">
            <Plus className="size-4" /> New notebook
          </button>
        ) : (
          <Button variant="accent">
            <Plus className="size-4 mr-1.5" /> New notebook
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a notebook</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              className="w-14 text-center text-lg"
              maxLength={4}
            />
            <Input
              required
              autoFocus
              placeholder="e.g. AI Research"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <Textarea
            placeholder="Optional description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={busy} variant="accent">
              {busy ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
