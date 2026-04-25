"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { MessageSquare, FileText, Sparkles, Network, Bot, Users } from "lucide-react";

const TABS = [
  { id: "chat", label: "Chat", icon: MessageSquare, href: "" },
  { id: "sources", label: "Sources", icon: FileText, href: "/sources" },
  { id: "notes", label: "Notes", icon: Sparkles, href: "/notes" },
  { id: "graph", label: "Graph", icon: Network, href: "/graph" },
  { id: "agents", label: "Agents", icon: Bot, href: "/agents" },
  { id: "members", label: "Members", icon: Users, href: "/members" },
] as const;

interface Props {
  notebookId: string;
  active: (typeof TABS)[number]["id"];
  notebookTitle: string;
}

export function NotebookTabs({ notebookId, active, notebookTitle }: Props) {
  return (
    <div className="border-b px-4 flex items-center gap-4">
      <div className="py-2 text-sm text-muted-foreground truncate max-w-[40%]">{notebookTitle}</div>
      <nav className="flex">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={`/notebook/${notebookId}${t.href}`}
              className={cn(
                "flex items-center gap-1.5 px-3 h-10 text-sm border-b-2 -mb-px",
                active === t.id
                  ? "border-accent text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" /> {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
