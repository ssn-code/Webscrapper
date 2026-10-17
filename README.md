# WebScrapper

WebScrapper is a local-first web inspection tool for public URLs. It fetches a page, extracts metadata and content, evaluates the page for common SEO issues, checks links, and exports structured results as JSON or CSV.

## What it does

- Scrapes a single public URL and extracts:
  - page title and meta description
  - headings, paragraphs, links, and images
  - optional CSS-selected content
  - HTTP response metadata and final URL
- Runs an evidence-based SEO audit with recommendations
- Checks a bounded set of extracted links for status and robots-policy compliance
- Exports an owned run as JSON or CSV
- Accepts a sequential batch of up to 10 unique URLs
- Persists per-session history in memory using a browser session cookie
- Exposes admin-only logs and configuration controls behind `ADMIN_TOKEN`
- Serves static About / Contact / Privacy / Terms pages

## Security posture

This project is intentionally hardened for safe public-page inspection:

- Only HTTP/HTTPS and standard ports are allowed
- Private, local, and single-label hostnames are rejected
- URL credentials are rejected
- DNS results are resolved and pinned before requests are allowed
- Redirects are revalidated and limited
- Response bodies are capped to prevent oversized downloads
- Requests time out and enforce request budgets
- Robots.txt checks are enforced by default for each requested path
- CORS is same-origin by default and only allows explicit origins when configured
- Admin-only endpoints require a bearer token

This is not a general-purpose crawler and should not be used to bypass authentication, paywalls, CAPTCHAs, or site restrictions.

## Stack

- Node.js 22+
- Express + TypeScript
- React 19 + Vite
- Tailwind CSS
- Cheerio
- Google robots parser

## Local setup

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Open the app at `http://localhost:3000` by default. If port 3000 is already taken, set a different port locally, for example:

```powershell
$env:PORT = "3001"
npm run dev
```

Useful commands:

```powershell
npm run build
npm start
npm test
npm run lint
```

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP listening port | `3000` |
| `HOST` | Bind address | `0.0.0.0` |
| `NODE_ENV` | Runtime mode | `development` |
| `SCRAPER_TIMEOUT` | Default scraper timeout in milliseconds | `30000` |
| `SCRAPER_USER_AGENT` | Outbound crawler user-agent | `WebScrapperBot/1.0` |
| `ADMIN_TOKEN` | Required for admin log and config endpoints | unset |
| `CORS_ALLOWED_ORIGINS` | Exact trusted origins for browser access | empty (same-origin only) |

Use a strong admin token in any non-local deployment. Do not commit `.env` files.

## API overview

- `GET /api/health` returns server health status
- `POST /api/scrape` scrapes a URL and returns extracted data
- `GET /api/history` lists the current browser session's runs
- `GET /api/history/:id` returns a single owned run
- `DELETE /api/history/:id` deletes one owned run
- `DELETE /api/history` clears the current session's history
- `GET /api/export/:id?format=json|csv&type=all|headings|links|images|paragraphs` exports a run
- `POST /api/links/check` validates a bounded set of extracted destinations
- `GET /api/logs` requires `Authorization: Bearer <ADMIN_TOKEN>`
- `GET /api/config` returns the current scraper settings
- `POST /api/config` updates safe scraper settings and requires `ADMIN_TOKEN`

The app responds with JSON errors for failed requests. Scrape failures caused by robots policy or target restrictions are surfaced in a structured way.

## Batch and UI

The frontend includes:

- a single-page scraper form
- a history sidebar
- results and SEO tabs
- a batch queue modal for up to 10 unique URLs
- admin logs and config modals
- public static pages at `/about`, `/contact`, `/privacy`, and `/terms`

## Current limitations

This version is intentionally transparent about the boundaries of the tool:

- history and logs are process-local and reset on restart
- session state is isolated by an HTTP-only cookie and is limited per browser session
- there is no durable multi-user database or authentication layer
- this is not a production deployment system and should be placed behind HTTPS and a trusted reverse proxy in real environments
- SEO findings are heuristic and are not ranking predictions or search analytics

## Verification

```powershell
npm test
npm run lint
npm run build
```

These checks are the main validation path for the project before release or deployment.
