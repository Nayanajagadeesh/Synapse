"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Volume2, Bot, User } from "lucide-react";
import type { Citation } from "@/types/domain";
import { cn } from "@/lib/utils";

interface SourceMeta {
  tag: number;
  source_id: string;
  title?: string;
  kind?: string;
  snippet?: string;
}

interface Props {
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  citations?: Citation[];
  sources?: SourceMeta[];
  onSpeak?: () => void;
}

/** Replace `[#n]` markers with clickable spans pointing at the corresponding source. */
function renderWithCitations(content: string): string {
  return content.replace(/\[#(\d+)\]/g, (_m, n) => `<span class="cite" data-tag="${n}">${n}</span>`);
}

export function MessageBubble({ role, content, streaming, citations, sources, onSpeak }: Props) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn("size-7 rounded-md grid place-items-center shrink-0", isUser ? "bg-secondary" : "bg-accent text-accent-foreground")}>
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={cn(
          "rounded-2xl px-4 py-3 max-w-[80%] text-sm shadow-sm",
          isUser ? "bg-secondary" : "bg-card border"
        )}
      >
        <div
          className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5"
          // Markdown first, then citation tags. We keep the dangerouslySet path *after*
          // the markdown render to preserve sanitisation done by react-markdown.
        >
          {isUser ? (
            <p className="whitespace-pre-wrap m-0">{content}</p>
          ) : (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p>{decorateChildren(children)}</p>,
                  li: ({ children }) => <li>{decorateChildren(children)}</li>,
                }}
              >
                {content}
              </ReactMarkdown>
              {streaming && <span className="inline-block w-1.5 h-4 align-middle bg-foreground/60 animate-pulse ml-0.5" />}
            </>
          )}
        </div>

        {!isUser && sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Sources</p>
            <ul className="space-y-1">
              {sources.map((s) => (
                <li key={s.tag} className="text-xs flex gap-2">
                  <span className="cite" data-tag={s.tag}>{s.tag}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.title ?? "(untitled source)"}</p>
                    {s.snippet && (
                      <p className="text-muted-foreground line-clamp-2">{s.snippet}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isUser && !streaming && content && onSpeak && (
          <button
            onClick={onSpeak}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mt-2"
          >
            <Volume2 className="size-3" /> Listen
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Walk a list of children replacing `[#n]` text with citation pills.
 * react-markdown gives us strings + nodes — we only transform strings.
 */
function decorateChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") return splitCites(children);
  if (Array.isArray(children)) return children.map((c, i) => <span key={i}>{decorateChildren(c)}</span>);
  return children;
}

function splitCites(s: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  const re = /\[#(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(
      <span key={`c-${m.index}`} className="cite" data-tag={m[1]}>
        {m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}
