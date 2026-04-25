# Synapse

> Collaborative AI research notebook with real-time RAG, autonomous agents, and cross-document insights.

Synapse is a Notion-meets-NotebookLM-meets-ChatGPT for teams. Drop in PDFs, articles, YouTube videos, or RSS feeds; ask questions and get cited answers grounded only in your sources; let agents keep your knowledge base fresh; collaborate live with teammates.

---

## Feature checklist

| Area | What you get |
| --- | --- |
| Multi-source ingest | PDF / DOCX / TXT upload, URL scraping, YouTube transcripts, RSS feeds, periodic auto-sync |
| RAG chat | Streaming responses, citations, snippet highlighting, scoped to the current notebook |
| Smart notes | Auto-summary on ingest, ELI5 / Exam / Research modes, structured bullets, mind-map outline |
| Multi-notebook | Per-notebook knowledge bases with optional cross-notebook search |
| Real-time engine | RSS / webpage polling, "new insight" notifications |
| Agents | Saved jobs that fetch → analyse → store → notify, optionally via n8n |
| Collaboration | Multi-member notebooks, viewer / editor / admin roles, live presence, comments |
| Voice mode | TTS narration of any note, voice query input |
| Knowledge graph | Force-directed graph of concepts and source-to-source links |
| Insight generator | Detects trends, contradictions, and surprising facts across sources |

---

## Architecture

```
                   ┌──────────────────────────┐
                   │      Next.js App         │
                   │  (App Router · RSC · UI) │
                   └────────────┬─────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
  ┌──────────────┐     ┌──────────────────┐    ┌─────────────┐
  │  /api/chat   │     │  /api/sources/*  │    │ /api/notes  │
  │  streaming   │     │  ingestion       │    │ summary &   │
  │  RAG answer  │     │                  │    │ insights    │
  └──────┬───────┘     └────────┬─────────┘    └──────┬──────┘
         │                      │                     │
         ▼                      ▼                     ▼
  ┌─────────────────────────────────────────────────────────┐
  │             lib/llm   (provider-agnostic)               │
  │   openai · anthropic · groq · embeddings · TTS          │
  └─────────────────────────────────────────────────────────┘
         │                      │                     │
         ▼                      ▼                     ▼
  ┌─────────────────────────────────────────────────────────┐
  │         Supabase: Postgres + pgvector + Auth            │
  │    notebooks · sources · chunks(vector) · notes ·       │
  │    messages · agents · members · comments               │
  └─────────────────────────────────────────────────────────┘
                                │
                                ▼
                       ┌────────────────┐
                       │     n8n        │
                       │ (agent runner) │
                       └────────────────┘
```

The LLM layer is provider-agnostic — flip `LLM_PROVIDER` between `openai`, `anthropic`, and `groq` without touching application code. Embeddings always run through OpenAI (or any OpenAI-compatible endpoint) because that's the only major embeddings API right now.

---

## Quick start

### 1. Install

```bash
git clone <your fork>
cd synapse
npm install
```

### 2. Spin up Supabase

Create a new project at [supabase.com](https://supabase.com), then:

1. Open the SQL editor and run `supabase/schema.sql` — this enables pgvector, creates every table, sets up Row Level Security, and registers the `match_chunks` similarity-search function.
2. (Optional) Run `supabase/seed.sql` for a demo notebook with a sample source.
3. In Authentication → Providers, enable Email and (optionally) Google.
4. In Storage, create a public bucket called `sources`.
5. Grab your project URL, anon key, and service-role key from Settings → API.

### 3. Configure environment

```bash
cp .env.example .env.local
# fill in Supabase + at least one of OPENAI_API_KEY / ANTHROPIC_API_KEY / GROQ_API_KEY
```

### 4. Run

```bash
npm run dev
# open http://localhost:3000
```

### 5. (Optional) Run agents

```bash
docker compose up -d n8n
# open http://localhost:5678
# import workflows from ./n8n/workflows/
```

---

## Folder structure

```
synapse/
├── README.md
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── components.json              # shadcn config
├── docker-compose.yml           # n8n
├── .env.example
├── supabase/
│   ├── schema.sql               # tables, RLS, pgvector, RPCs
│   └── seed.sql                 # demo notebook
├── n8n/workflows/               # importable n8n flows
├── src/
│   ├── app/
│   │   ├── (auth)/login         # login page + OAuth callback
│   │   ├── (app)/               # authenticated shell
│   │   │   ├── dashboard
│   │   │   └── notebook/[id]/   # chat · sources · notes · graph · agents · members
│   │   └── api/                 # all server routes
│   ├── components/
│   │   ├── ui/                  # shadcn primitives
│   │   ├── chat/                # streaming chat panel + citations
│   │   ├── sources/             # upload, URL, YouTube, list
│   │   ├── notebooks/           # sidebar, cards
│   │   ├── notes/               # summaries, insights
│   │   ├── graph/               # knowledge graph
│   │   ├── agents/              # agent CRUD
│   │   ├── members/             # invites, roles
│   │   └── theme/
│   ├── lib/
│   │   ├── supabase/            # browser/server/admin clients
│   │   ├── llm/                 # provider-agnostic chat & embeddings
│   │   ├── rag/                 # chunking, ingestion, retrieval, prompts
│   │   ├── ingest/              # PDF, DOCX, URL, YouTube, RSS adapters
│   │   ├── insights.ts
│   │   ├── graph.ts
│   │   ├── tts.ts
│   │   └── utils.ts
│   ├── hooks/                   # useChat, useRealtime
│   └── types/                   # database & domain types
```

---

## API routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET / POST` | `/api/notebooks` | List / create notebooks |
| `GET / PATCH / DELETE` | `/api/notebooks/[id]` | Fetch / rename / delete |
| `POST` | `/api/sources/upload` | Upload PDF / DOCX / TXT (FormData) |
| `POST` | `/api/sources/url` | Ingest a webpage |
| `POST` | `/api/sources/youtube` | Ingest a YouTube video |
| `POST` | `/api/sources/rss` | Subscribe to an RSS feed |
| `GET` | `/api/sources?notebookId=…` | List sources |
| `POST` | `/api/chat` | Streaming RAG answer (returns SSE/text-stream) |
| `POST` | `/api/notes/summary` | Summarise one source or whole notebook |
| `POST` | `/api/notes/insights` | Cross-document trends / contradictions |
| `GET / POST` | `/api/agents` | List / create agents |
| `POST` | `/api/agents/[id]/run` | Trigger an agent now |
| `GET / POST / DELETE` | `/api/members` | Manage notebook members |
| `POST` | `/api/tts` | Text-to-speech |
| `POST` | `/api/webhooks/n8n` | Receives findings from n8n agents |

All routes that touch user data verify the Supabase session and rely on RLS as a second line of defence.

---

## Database schema (high-level)

See `supabase/schema.sql` for the full DDL. Key tables:

- `notebooks` — top-level container, owned by a user, has many members.
- `notebook_members` — `(user_id, notebook_id, role)` where role ∈ `viewer | editor | admin`.
- `sources` — one row per ingested document/URL/video/feed; `kind`, `status`, `metadata`.
- `chunks` — text chunks with `embedding vector(1536)`; an `match_chunks(notebook_id, query_embedding, k)` RPC is provided.
- `messages` — chat history, with `citations jsonb` linking to chunk ids.
- `notes` — auto-generated summaries/outlines per source or notebook.
- `agents` — saved jobs with `schedule cron`, `instructions`, last-run state.
- `comments` — threaded discussion attached to chunks or notes.
- `notifications` — fan-out for "new insight available", agent finished, etc.

---

## Deployment

| Layer | Where | Notes |
| --- | --- | --- |
| Next.js app | Vercel (recommended) or Render | Set every variable from `.env.example` in the dashboard. |
| Database | Supabase | Free tier is fine for an MVP. |
| n8n | Render / Fly.io / your own VM | Run via the provided `docker-compose.yml`. |

A one-click deploy button can be added once you push to GitHub: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new).

---

## Roadmap / gaps

The scaffold ships every feature end-to-end as a working slice, but a few are intentionally simple so the codebase stays readable:

- Live cursors / Y.js CRDT for collaboration — currently uses Supabase Realtime broadcast; swap in [Liveblocks](https://liveblocks.io) or Y.js for full Google-Docs fidelity.
- Knowledge graph is built from chunk co-occurrence; tighten it with NER + entity linking.
- Agents run on n8n cron; swap in Trigger.dev or Inngest if you prefer code-defined jobs.
- Chrome extension stub is omitted — see `docs/chrome-extension.md` for the spec.

---

## License

MIT
