# WebScrapper

WebScrapper inspects a single public web page and extracts metadata, headings, paragraphs, links, images, and optional CSS-selected content. It includes an evidence-based SEO checklist, bounded link checks, JSON/CSV exports, and a sequential batch interface.

## Stack and Prerequisites

- Node.js 22.9 or newer
- Express, TypeScript, React 19, Vite, Tailwind CSS, and Cheerio
- In-memory history and logs; no database is used

## Local Setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:3000`. The server loads `.env` using Node 22's environment-file support. `npm run build` creates the frontend production bundle; `npm start` serves it through the Express server.

## Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP listening port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Runtime mode | Development |
| `SCRAPER_TIMEOUT` | Default fetch timeout in milliseconds, clamped to 1-30 seconds | `30000` |
| `SCRAPER_USER_AGENT` | Outbound crawler identity; control characters are rejected | `WebScrapperBot/1.0` |
| `ADMIN_TOKEN` | Bearer token required to read logs and change configuration | unset (admin operations disabled) |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact origins for cross-origin browser access | empty (same-origin only) |

Use a long, random `ADMIN_TOKEN` outside local development. Do not commit `.env`. Cross-origin deployments must list exact trusted origins; `*` is not supported.

## Security and Limits

- Only HTTP/HTTPS and standard ports are accepted. Local/special-use IP ranges, single-label names, private DNS results, and URL credentials are blocked.
- DNS results are resolved and pinned for each connection. Redirects are followed manually (maximum five), with every destination resolved and checked again.
- HTML responses are streamed with a 2 MiB cap, requests time out after at most 30 seconds, and at most four scrapes run concurrently with a queue of 16.
- API requests are rate-limited; scrape requests have a separate 15-per-minute limit. The batch UI accepts at most 10 unique URLs. Link checks cover at most 25 unique destinations with three workers per operation. CSS selectors, JSON bodies, raw HTML, and extracted item counts are bounded.
- Security headers are enabled. CORS is same-origin by default.
- Robots checks are enabled by default. `robots.txt` uses Google's `robotstxt` parser port, is fetched through the same SSRF-safe transport, cached for 12 hours on success, and evaluated per requested path for `WebScrapperBot`. A `404` means no published rules. Other `4xx` responses are treated as unavailable rules and allow access; `5xx`, network failures, invalid redirects, and timeouts fail closed. `Crawl-delay` is honored up to 60 seconds alongside the configured delay. Disabling this setting skips robots rules but not SSRF protection, response limits, or per-origin request serialization.
- History is isolated by an unguessable, HTTP-only browser session cookie, retained in memory for up to 24 hours, and limited to 20 records per session. All state is lost on restart. Logs are bounded and require `ADMIN_TOKEN` to read; configuration writes also require it.
- Network-level egress restrictions are still recommended in production. The application only inspects publicly reachable resources and does not bypass access controls.

## API

- `GET /api/health` returns `{ "status": "ok" }`.
- `POST /api/scrape` accepts JSON such as `{ "url": "https://example.com", "selector": "main", "include_html": false, "timeout": 10000 }`. The response contains extraction results and HTTP metadata.
- `GET /api/history` lists the current browser session's runs; `GET /api/history/:id` returns one owned run.
- `DELETE /api/history/:id` deletes one owned run; `DELETE /api/history` clears only the current session's history.
- `GET /api/export/:id?format=json|csv&type=all|headings|links|images|paragraphs` exports an owned run.
- `POST /api/links/check` accepts `{ "id": "<owned-run-id>" }` and checks at most 25 unique extracted destinations. It checks robots rules, tries HEAD first, falls back to a bounded GET only for 405/501, and returns status, final URL, and safe error explanations. Disconnecting the request cancels active work.
- `GET /api/logs` requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `GET /api/config` returns scraper settings. `POST /api/config` requires the same Bearer authorization and accepts validated configuration values.

Disallowed paths return `403` with code `ROBOTS_DISALLOWED`. If robots rules cannot be fetched, scraping fails closed with `503` and code `ROBOTS_UNAVAILABLE`. Successful records include `robots_allowed` and `robots_status`.

SEO scores weight 19 checks equally (pass = 1, warning = 0.5, fail = 0). Findings include extracted evidence and a recommendation; they are content/usability heuristics, not ranking predictions, and do not use private search analytics.

All API errors use JSON. History and configuration are process-local; use a single-process deployment if you need predictable in-memory behavior. Put the service behind HTTPS and a reverse proxy, and restrict outbound traffic at the network layer as defense in depth.

## Checks

```powershell
npm test
npm run lint
npm run build
```

## Current Limitations

Persistent authenticated storage, public About/Contact/Privacy/Terms pages, production deployment verification, progress streaming for long link checks, robust multi-process batch jobs, and broad security integration tests are not implemented yet. History remains process-local and is lost on restart; do not treat this version as ready for public beta until the remaining work and deployment-specific security review are complete.
