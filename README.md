# IPO Watch

Open / upcoming / closed Indian IPOs from NSE India's free public listings (no key, no paid plan), optionally enriched by the [ipoalerts](https://ipoalerts.in) API, stored in a local SQLite file and refreshed by background agents. Next.js 16 + TypeScript + Tailwind.

## Run it

```bash
npm install
cp .env.example .env.local     # then fill in the keys (never commit this file)
npm run agent:sync             # first fill of the database
npm run dev                    # http://localhost:3000
npm run agents                 # keep running: daily scheduler (separate process)
```

`.env.local`

| Variable                                    | Purpose                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `IPOALERTS_API_KEY`                         | optional — adds company description, strengths, risks, logo (free plan: open IPOs only) |
| `IPOALERTS_ENRICH`                          | set `off` to ignore the key and use NSE only                                            |
| `NSE_HISTORY_DAYS`                          | closed/listed history kept (default 180)                                                |
| `IPOALERTS_PLAN` / `IPOALERTS_DAILY_BUDGET` | optional ipoalerts pacing (free by default, 22 calls/day)                               |
| `ANTHROPIC_API_KEY`                         | optional — enables AI summaries                                                         |
| `AI_DAILY_CAP` / `ANTHROPIC_MODEL`          | optional — summaries per day (15) / model (`claude-sonnet-5-5`)                         |

## Agents (`agents/`)

| Agent     | What it does                                                                                                                                                                                                   | Run once                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| sync      | Pulls current, upcoming and recent past IPOs from NSE's public listings (3 small requests), validates with Zod, upserts, records subscription snapshots. If an ipoalerts key is set it also enriches open IPOs | `npm run agent:sync`      |
| status    | Advances archived IPOs by date (open → closed → listed), prunes old data                                                                                                                                       | `npm run agent:status`    |
| summarize | Claude writes a short plain-English summary per IPO (capped per day)                                                                                                                                           | `npm run agent:summarize` |

`npm run agents` runs them on a schedule (IST): 09:00, 13:00, 17:30 (sync → status → summarize) and 00:10 (status). Every run is logged in the `agent_runs` table.

### Data sources

- **NSE (primary, free):** the same JSON the nseindia.com IPO pages use. Unofficial, can change or lag, NSE-listed issues only (BSE-only SME IPOs are not included). Check NSE's terms of use before any public/commercial deployment.
- **ipoalerts (optional):** richer text for open IPOs. Free plan = open only, 25 calls/day; the app caps itself.
- Companies that have only filed a draft prospectus aren't shown until NSE publishes their dates, so Upcoming is often short.

## Security notes

- API keys live only in `.env.local`; the browser calls only this app's own read-only `/api/ipos`.
- Nonce-based CSP, HSTS, `X-Frame-Options`, `nosniff`, referrer/permissions policies; per-IP rate limit and GET-only on `/api` (`src/proxy.ts`).
- All query params validated with Zod; SQL is parameterized; API data is validated and non-http(s) URLs dropped before storage; text is rendered escaped; external links use `rel="noopener noreferrer"`.
- AI input is treated as untrusted data; output stored and shown as plain text.
- Before a public launch: serve over HTTPS behind a reverse proxy, replace the in-memory rate limiter with a shared one, move the DB off a local file if you scale out, and re-run `npm audit`.

## Checks

`npm run typecheck` · `npm run lint` · `npm test` · `npm run build`
