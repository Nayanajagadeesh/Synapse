"use client";

import { useState } from "react";
import { Plus, Upload, Link as LinkIcon, Youtube, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";

type Mode = "menu" | "upload" | "url" | "youtube" | "rss";

export function AddSourceMenu({ notebookId }: { notebookId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setMode("menu"); }}>
      <Button variant="outline" size="sm" onClick={() => { setOpen(true); setMode("menu"); }}>
        <Plus className="size-4 mr-1.5" /> Add
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
          <DialogDescription>Choose where the data is coming from.</DialogDescription>
        </DialogHeader>

        {mode === "menu" && (
          <div className="grid grid-cols-2 gap-2">
            <MenuButton icon={<Upload className="size-5" />} label="Upload file" sub="PDF · DOCX · TXT" onClick={() => setMode("upload")} />
            <MenuButton icon={<LinkIcon className="size-5" />} label="Web page" sub="Live scraping" onClick={() => setMode("url")} />
            <MenuButton icon={<Youtube className="size-5" />} label="YouTube" sub="Transcript" onClick={() => setMode("youtube")} />
            <MenuButton icon={<Rss className="size-5" />} label="RSS feed" sub="Auto-sync" onClick={() => setMode("rss")} />
          </div>
        )}

        {mode === "upload" && <UploadForm notebookId={notebookId} onDone={() => setOpen(false)} />}
        {mode === "url" && <SimpleForm endpoint="/api/sources/url" notebookId={notebookId} placeholder="https://example.com/article" onDone={() => setOpen(false)} label="URL" />}
        {mode === "youtube" && <SimpleForm endpoint="/api/sources/youtube" notebookId={notebookId} placeholder="https://youtube.com/watch?v=…" onDone={() => setOpen(false)} label="YouTube URL" />}
        {mode === "rss" && <SimpleForm endpoint="/api/sources/rss" notebookId={notebookId} placeholder="https://example.com/feed.xml" onDone={() => setOpen(false)} label="Feed URL" />}
      </DialogContent>
    </Dialog>
  );
}

function MenuButton({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg border p-4 text-left hover:border-accent/40 hover:bg-muted/50 transition"
    >
      <div className="text-accent mb-2">{icon}</div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </button>
  );
}

function UploadForm({ notebookId, onDone }: { notebookId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt", ".md"],
    },
    onDrop: async (files) => {
      if (busy) return;
      setBusy(true);
      try {
        for (const f of files) {
          const fd = new FormData();
          fd.append("notebookId", notebookId);
          fd.append("file", f);
          const r = await fetch("/api/sources/upload", { method: "POST", body: fd });
          if (!r.ok) throw new Error((await r.json()).error ?? "Upload failed");
        }
        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} uploaded — processing…`);
        onDone();
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setBusy(false);
      }
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`rounded-lg border border-dashed p-10 text-center cursor-pointer transition ${isDragActive ? "bg-accent/10 border-accent" : ""}`}
    >
      <input {...getInputProps()} />
      <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
      <p className="text-sm">Drag files here or click to browse</p>
      <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT · up to 25 MB each</p>
      {busy && <p className="text-xs mt-3">Uploading…</p>}
    </div>
  );
}

function SimpleForm({
  endpoint,
  notebookId,
  placeholder,
  label,
  onDone,
}: {
  endpoint: string;
  notebookId: string;
  placeholder: string;
  label: string;
  onDone: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, url }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Failed");
      toast.success("Source queued — processing…");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="text-sm font-medium">{label}</label>
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={placeholder} type="url" required />
      <Button type="submit" variant="accent" disabled={busy} className="w-full">
        {busy ? "Adding…" : "Add source"}
      </Button>
    </form>
  );
}
