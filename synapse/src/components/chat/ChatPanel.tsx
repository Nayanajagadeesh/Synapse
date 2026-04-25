"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MessageBubble } from "./MessageBubble";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Citation, Message } from "@/types/domain";
import { toast } from "sonner";

interface Props {
  notebookId: string;
  initialMessages: Message[];
}

interface SourceMeta {
  tag: number;
  source_id: string;
  title?: string;
  kind?: string;
  snippet?: string;
}

interface UiMessage extends Pick<Message, "role" | "content"> {
  id: string;
  citations?: Citation[];
  sources?: SourceMeta[];
  /** True while we're streaming — used to show the cursor. */
  streaming?: boolean;
}

const MODES = [
  { id: "default", label: "Default", hint: undefined },
  { id: "eli5", label: "Explain like I'm 5", hint: "Explain in very simple terms with everyday analogies." },
  { id: "exam", label: "Exam mode", hint: "Quiz the user with 3 conceptual follow-up questions after the answer." },
  { id: "research", label: "Research mode", hint: "Be exhaustive, cite every source, and discuss limitations and counter-evidence." },
];

export function ChatPanel({ notebookId, initialMessages }: Props) {
  const [messages, setMessages] = useState<UiMessage[]>(() =>
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role as UiMessage["role"],
      content: m.content,
      citations: (m.citations as Citation[]) ?? [],
    }))
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("default");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live updates: pick up messages from collaborators
  useEffect(() => {
    const supa = createSupabaseBrowserClient();
    const channel = supa
      .channel(`messages:${notebookId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `notebook_id=eq.${notebookId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicating our own optimistic messages
            if (prev.some((p) => p.id === m.id)) return prev;
            return [
              ...prev,
              { id: m.id, role: m.role as UiMessage["role"], content: m.content, citations: (m.citations as Citation[]) ?? [] },
            ];
          });
        }
      )
      .subscribe();
    return () => { supa.removeChannel(channel); };
  }, [notebookId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!input.trim() || busy) return;
    setBusy(true);
    const userMsg: UiMessage = { id: crypto.randomUUID(), role: "user", content: input };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);
    const history = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    const userText = input;
    setInput("");

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebookId,
          message: userText,
          mode: MODES.find((m) => m.id === mode)?.hint,
          history,
        }),
      });
      if (!r.ok || !r.body) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? "Chat failed");
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Strip the citation sentinel if it's already arrived
        const sentinelIdx = buf.indexOf("\n\n[[CITATIONS]]");
        const visible = sentinelIdx === -1 ? buf : buf.slice(0, sentinelIdx);
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: visible } : m))
        );
      }

      // Parse trailing citations payload
      const idx = buf.indexOf("\n\n[[CITATIONS]]");
      if (idx !== -1) {
        const json = buf.slice(idx + "\n\n[[CITATIONS]]".length);
        try {
          const parsed = JSON.parse(json) as { citations: Citation[]; sources: SourceMeta[] };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: buf.slice(0, idx),
                    citations: parsed.citations,
                    sources: parsed.sources,
                    streaming: false,
                  }
                : m
            )
          );
        } catch {
          /* ignore */
        }
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
        );
      }
    } catch (e: any) {
      toast.error(e.message ?? "Chat error");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "_Sorry — something went wrong._", streaming: false }
            : m
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function speak(text: string) {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "TTS failed");
      const blob = await r.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="h-full grid grid-rows-[1fr_auto] bg-background">
      <div ref={scrollRef} className="overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-20 space-y-2">
              <Sparkles className="size-8 mx-auto text-accent" />
              <p className="text-sm">Ask anything about your sources.</p>
              <p className="text-xs">Answers cite the exact passages they use.</p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              streaming={m.streaming}
              citations={m.citations}
              sources={m.sources}
              onSpeak={() => speak(m.content)}
            />
          ))}
        </div>
      </div>

      <div className="border-t p-3 bg-background">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <div className="w-44 shrink-0">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Ask a question, summarise a source, find contradictions…"
            className="flex-1 min-h-[40px]"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={busy || !input.trim()} variant="accent">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
