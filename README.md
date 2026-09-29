# WebScraper

Production-ready modular web scraper with real-time DOM extraction, headings analysis, link resolution, image exploration, structured data inspection, and multi-format exports.

## Features

- **Full DOM Extraction**: Standalone fast DOM parsing engine extracting document titles, meta descriptions, hierarchical headings (`h1`-`h6`), paragraphs, hyperlinks, and images.
- **Link & Media Resolution**: Automatically normalizes relative hyperlinks and image sources to resolved absolute URLs, classifying internal vs. external links.
- **Custom CSS Selectors**: Supply arbitrary CSS selectors (e.g. `article`, `div.quote`, `.post`) to extract specific page elements and attributes.
- **Multi-Format Serialization**: Instant exports to JSON conforming to `ScrapedData` standard schema and CSV formats (Summary, Headings, Links, Images, Paragraphs).
- **Batch Scraping Queue**: Process multiple URLs in sequential queue with courteous delays and progress tracking.
- **Dual-Stream Diagnostic Logs**: View in-app real-time rotating activity logs (`/api/logs`) mirroring server-side scraping lifecycle events.
- **In-Memory Run History**: History drawer allowing fast comparison and review of previously scraped websites.

## Architecture

- **Backend**: Express on Node.js 22 with Cheerio & Axios
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Port**: 3000 (`0.0.0.0`)

## Running Locally

```bash
npm install
npm run dev
```

The application will be accessible at `http://localhost:3000`.
