# Synapse · n8n workflows

Drop these JSON files into a running n8n instance via **Workflows → Import from file**.

| File | What it does |
| --- | --- |
| `ai-news-tracker.json` | Cron-runs every morning, hits an RSS feed, pushes findings to `/api/webhooks/n8n` |
| `agent-runner.json` | Generic shape: cron → call Synapse `/api/agents/:id/run` → notify on Slack |

Set the following credentials inside n8n before running:

- **Synapse API URL** — env `SYNAPSE_API_URL` (defaults to `http://host.docker.internal:3000` in `docker-compose.yml`)
- **Synapse webhook secret** — env `SYNAPSE_WEBHOOK_SECRET`, must match `N8N_WEBHOOK_SECRET` in your `.env.local`

You can also manage agents entirely inside Synapse (Notebook → Agents tab) without n8n; n8n is recommended once you want reliable scheduling and richer triggers.
