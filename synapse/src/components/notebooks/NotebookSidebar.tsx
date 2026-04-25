"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateNotebookButton } from "./CreateNotebookButton";

interface Item { id: string; title: string; emoji: string | null; updated_at: string }

export function NotebookSidebar({ notebooks }: { notebooks: Item[] }) {
  const path = usePathname();
  return (
    <div className="p-3 flex flex-col gap-3 h-full">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted">
        <div className="size-7 rounded-md bg-accent grid place-items-center text-accent-foreground">
          <Sparkles className="size-4" />
        </div>
        <span className="font-semibold tracking-tight">Synapse</span>
      </Link>

      <CreateNotebookButton variant="sidebar" />

      <nav className="flex-1 overflow-y-auto -mx-1 px-1 mt-1">
        <p className="px-2 text-xs font-medium text-muted-foreground mb-1">Notebooks</p>
        <ul className="space-y-0.5">
          {notebooks.map((n) => {
            const active = path?.startsWith(`/notebook/${n.id}`);
            return (
              <li key={n.id}>
                <Link
                  href={`/notebook/${n.id}`}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted",
                    active && "bg-muted text-foreground"
                  )}
                >
                  <span className="size-5 grid place-items-center text-base">{n.emoji ?? "📓"}</span>
                  <span className="truncate">{n.title}</span>
                </Link>
              </li>
            );
          })}
          {notebooks.length === 0 && (
            <li className="px-2 py-2 text-xs text-muted-foreground">
              No notebooks yet.
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
