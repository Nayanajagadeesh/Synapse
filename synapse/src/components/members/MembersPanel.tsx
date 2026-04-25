"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Member {
  user_id: string;
  role: "viewer" | "editor" | "admin";
  profiles: { email: string | null; display_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  notebookId: string;
  initialMembers: Member[];
}

export function MembersPanel({ notebookId, initialMembers }: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("viewer");
  const [busy, setBusy] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, email, role }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Invite failed");
      toast.success("Member added");
      setOpen(false); setEmail("");
      // Re-fetch
      const fresh = await fetch(`/api/members?notebookId=${notebookId}`).then((r) => r.json());
      setMembers(fresh.members ?? []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(userId: string) {
    if (!confirm("Remove this member?")) return;
    const r = await fetch(`/api/members?notebookId=${notebookId}&userId=${userId}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error ?? "Failed");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Members</h2>
          <p className="text-sm text-muted-foreground">Invite teammates and assign roles.</p>
        </div>
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-1.5" /> Invite
        </Button>
      </div>

      <ul className="rounded-xl border bg-card divide-y">
        {members.map((m) => {
          const initials = (m.profiles?.display_name ?? m.profiles?.email ?? "?").slice(0, 2).toUpperCase();
          return (
            <li key={m.user_id} className="flex items-center gap-3 p-3">
              <Avatar>
                <AvatarImage src={m.profiles?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {m.profiles?.display_name ?? m.profiles?.email ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">{m.profiles?.email}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md bg-muted">{m.role}</span>
              <Button variant="ghost" size="icon" onClick={() => remove(m.user_id)}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
        {members.length === 0 && <li className="p-4 text-sm text-muted-foreground">No members yet.</li>}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite a teammate</DialogTitle></DialogHeader>
          <form onSubmit={invite} className="space-y-3">
            <Input type="email" placeholder="email@team.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Select value={role} onValueChange={(v) => setRole(v as Member["role"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer · read-only</SelectItem>
                <SelectItem value="editor">Editor · can chat &amp; add sources</SelectItem>
                <SelectItem value="admin">Admin · full control</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="accent" disabled={busy} className="w-full">
              {busy ? "Inviting..." : "Send invite"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
