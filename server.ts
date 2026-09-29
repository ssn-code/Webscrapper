import express, { Request, Response } from 'express';
import cors from 'cors';
import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';

interface HeadingItem {
  level: number;
  text: string;
}

interface LinkItem {
  text: string;
  href: string;
  isExternal: boolean;
}

interface ImageItem {
  src: string;
  alt: string;
}

interface CustomSelectorResult {
  selector: string;
  count: number;
  items: Array<{ text: string; html: string; attributes: Record<string, string> }>;
}

export interface ScrapedData {
  id: string;
  url: string;
  final_url: string;
  title: string;
  meta_description: string;
  headings: HeadingItem[];
  paragraphs: string[];
  links: LinkItem[];
  images: ImageItem[];
  custom_selector?: CustomSelectorResult;
  raw_html?: string | null;
  status_code: number | null;
  content_type?: string;
  content_length_bytes?: number;
  duration_ms: number;
  timestamp: string;
}

interface ScraperConfig {
  user_agent: string;
  timeout_ms: number;
  delay_seconds: number;
  respect_robots: boolean;
}

const config: ScraperConfig = {
  user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  timeout_ms: 30000,
  delay_seconds: 1,
  respect_robots: true,
};

// In-memory run history (persists across requests during app session)
const historyStore = new Map<string, ScrapedData>();

// In-memory rotating log store
interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  logger: string;
  message: string;
}
const logsStore: LogEntry[] = [];
const MAX_LOGS = 200;

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', logger: string, message: string) {
  const entry: LogEntry = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    level,
    logger,
    message,
  };
  logsStore.unshift(entry);
  if (logsStore.length > MAX_LOGS) {
    logsStore.pop();
  }
  const consolePrefix = `[${entry.timestamp}] [${entry.level}] ${entry.logger}:`;
  if (level === 'ERROR') {
    console.error(consolePrefix, message);
  } else if (level === 'WARN') {
    console.warn(consolePrefix, message);
  } else {
    console.log(consolePrefix, message);
  }
}

log('INFO', 'server', 'Initializing WebScraper Backend Service...');

function validateUrl(rawUrl: string): string {
  let cleaned = (rawUrl || '').trim();
  if (!cleaned) {
    throw new Error('URL cannot be empty.');
  }

  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new Error(`Invalid URL format: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol '${parsed.protocol}'. Only http: and https: are supported.`);
  }

  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    throw new Error(`Invalid URL domain name: ${parsed.hostname}`);
  }

  return parsed.toString();
}

function extractAll(
  html: string,
  originalUrl: string,
  finalUrl: string,
  statusCode: number | null,
  durationMs: number,
  contentType: string,
  includeHtml: boolean,
  customSelector?: string
): ScrapedData {
  const $ = cheerio.load(html || '');
  const baseUrl = finalUrl || originalUrl;

  // Title extraction with fallbacks
  let title = $('title').first().text().trim();
  if (!title) {
    title = $('meta[property="og:title"]').attr('content')?.trim() || '';
  }
  if (!title) {
    title = $('h1').first().text().trim() || '';
  }

  // Meta description extraction with fallbacks
  let meta_description = $('meta[name="description" i]').attr('content')?.trim() || '';
  if (!meta_description) {
    meta_description = $('meta[property="og:description"]').attr('content')?.trim() || '';
  }

  // Headings
  const headings: HeadingItem[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tagName = el.tagName.toLowerCase();
    const level = parseInt(tagName.replace('h', ''), 10);
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text && !isNaN(level)) {
      headings.push({ level, text });
    }
  });

  // Paragraphs
  const paragraphs: string[] = [];
  $('p').each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text) {
      paragraphs.push(text);
    }
  });

  // Links
  const links: LinkItem[] = [];
  const seenLinks = new Set<string>();
  const baseDomain = new URL(baseUrl).hostname;

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href')?.trim() || '';
    if (!rawHref || /^(#|javascript:|mailto:|tel:)/i.test(rawHref)) {
      return;
    }

    try {
      const resolved = new URL(rawHref, baseUrl);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        const fullHref = resolved.toString();
        const text = $(el).text().replace(/\s+/g, ' ').trim() || '(No anchor text)';
        const key = `${fullHref}::${text}`;
        if (!seenLinks.has(key)) {
          seenLinks.add(key);
          const isExternal = resolved.hostname !== baseDomain;
          links.push({
            text,
            href: fullHref,
            isExternal,
          });
        }
      }
    } catch {
      // Ignore invalid URL conversions
    }
  });

  // Images
  const images: ImageItem[] = [];
  const seenImages = new Set<string>();
  $('img').each((_, el) => {
    const rawSrc = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim() || '';
    if (!rawSrc || rawSrc.startsWith('data:')) {
      return;
    }

    try {
      const resolved = new URL(rawSrc, baseUrl).toString();
      if (!seenImages.has(resolved)) {
        seenImages.add(resolved);
        const alt = $(el).attr('alt')?.trim() || '';
        images.push({
          src: resolved,
          alt,
        });
      }
    } catch {
      // Ignore invalid URL conversions
    }
  });

  // Custom Selector Extraction
  let customResult: CustomSelectorResult | undefined = undefined;
  if (customSelector && customSelector.trim()) {
    try {
      const matched = $(customSelector);
      const items: Array<{ text: string; html: string; attributes: Record<string, string> }> = [];
      matched.each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        const innerHtml = $(el).html()?.trim() || '';
        const attributes: Record<string, string> = {};
        if ('attribs' in el && el.attribs) {
          Object.assign(attributes, el.attribs);
        }
        items.push({ text, html: innerHtml, attributes });
      });
      customResult = {
        selector: customSelector,
        count: items.length,
        items,
      };
    } catch (err: any) {
      log('WARN', 'extractor', `Invalid custom selector "${customSelector}": ${err.message}`);
    }
  }

  const id = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    id,
    url: originalUrl,
    final_url: finalUrl,
    title,
    meta_description,
    headings,
    paragraphs,
    links,
    images,
    custom_selector: customResult,
    raw_html: includeHtml ? html : null,
    status_code: statusCode,
    content_type: contentType,
    content_length_bytes: Buffer.byteLength(html, 'utf-8'),
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '15mb' }));

  // API: Scrape endpoint
  app.post('/api/scrape', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const {
      url,
      selector,
      timeout = config.timeout_ms,
      include_html = false,
      user_agent = config.user_agent,
    } = req.body || {};

    let targetUrl: string;
    try {
      targetUrl = validateUrl(url);
    } catch (err: any) {
      log('WARN', 'main', `Validation failed for URL "${url}": ${err.message}`);
      return res.status(400).json({ error: err.message });
    }

    log('INFO', 'scraper', `Starting scrape for target: ${targetUrl}`);

    try {
      const response = await axios.get(targetUrl, {
        headers: {
          'User-Agent': user_agent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
        timeout: Math.min(Math.max(Number(timeout) || 30000, 1000), 60000),
        maxRedirects: 5,
        responseType: 'text',
        validateStatus: () => true, // Don't throw on 4xx/5xx status codes
      });

      const durationMs = Date.now() - startTime;
      const finalUrl = response.request?.res?.responseUrl || targetUrl;
      const statusCode = response.status;
      const contentType = String(response.headers['content-type'] || 'text/html');
      const html = typeof response.data === 'string' ? response.data : String(response.data || '');

      log('INFO', 'scraper', `HTTP ${statusCode} in ${durationMs}ms for ${targetUrl}`);

      const scrapedData = extractAll(
        html,
        targetUrl,
        finalUrl,
        statusCode,
        durationMs,
        contentType,
        Boolean(include_html),
        selector
      );

      // Save into in-memory storage
      historyStore.set(scrapedData.id, scrapedData);

      log(
        'INFO',
        'extractor',
        `Extracted: "${scrapedData.title.substring(0, 40)}" | ${scrapedData.headings.length} headings | ${scrapedData.paragraphs.length} paragraphs | ${scrapedData.links.length} links | ${scrapedData.images.length} images`
      );

      return res.json(scrapedData);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const message = err.code === 'ECONNABORTED'
        ? `Request timed out after ${timeout}ms`
        : (err.message || 'Scraping network error');
      log('ERROR', 'scraper', `Failed to scrape ${targetUrl}: ${message}`);
      return res.status(502).json({
        error: message,
        code: err.code || 'SCRAPE_FAILED',
        duration_ms: durationMs,
      });
    }
  });

  // API: Get history list
  app.get('/api/history', (_req: Request, res: Response) => {
    const list = Array.from(historyStore.values()).map(item => ({
      id: item.id,
      url: item.url,
      final_url: item.final_url,
      title: item.title,
      headings_count: item.headings.length,
      paragraphs_count: item.paragraphs.length,
      links_count: item.links.length,
      images_count: item.images.length,
      status_code: item.status_code,
      duration_ms: item.duration_ms,
      timestamp: item.timestamp,
    }));
    // Most recent first
    list.reverse();
    return res.json(list);
  });

  // API: Get single history item
  app.get('/api/history/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const item = historyStore.get(id);
    if (!item) {
      return res.status(404).json({ error: 'Run not found' });
    }
    return res.json(item);
  });

  // API: Delete single history item
  app.delete('/api/history/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const deleted = historyStore.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Run not found' });
    }
    log('INFO', 'storage', `Deleted run ${id}`);
    return res.json({ success: true, id });
  });

  // API: Clear all history
  app.delete('/api/history', (_req: Request, res: Response) => {
    const count = historyStore.size;
    historyStore.clear();
    log('INFO', 'storage', `Cleared all ${count} history runs`);
    return res.json({ success: true, count });
  });

  // API: Export in JSON or CSV
  app.get('/api/export/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const item = historyStore.get(id);
    if (!item) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const format = (req.query.format as string) || 'json';
    const type = (req.query.type as string) || 'all';

    if (format === 'csv') {
      let csvContent = '';
      if (type === 'headings') {
        csvContent = 'Level,Heading Text\n' + item.headings
          .map(h => `${h.level},"${h.text.replace(/"/g, '""')}"`)
          .join('\n');
      } else if (type === 'links') {
        csvContent = 'Anchor Text,Href,Is External\n' + item.links
          .map(l => `"${l.text.replace(/"/g, '""')}","${l.href.replace(/"/g, '""')}",${l.isExternal}`)
          .join('\n');
      } else if (type === 'images') {
        csvContent = 'Source URL,Alt Text\n' + item.images
          .map(i => `"${i.src.replace(/"/g, '""')}","${i.alt.replace(/"/g, '""')}"`)
          .join('\n');
      } else if (type === 'paragraphs') {
        csvContent = 'Index,Paragraph Text\n' + item.paragraphs
          .map((p, idx) => `${idx + 1},"${p.replace(/"/g, '""')}"`)
          .join('\n');
      } else {
        // Summary CSV
        csvContent = [
          'Property,Value',
          `URL,"${item.url.replace(/"/g, '""')}"`,
          `Final URL,"${item.final_url.replace(/"/g, '""')}"`,
          `Title,"${item.title.replace(/"/g, '""')}"`,
          `Meta Description,"${item.meta_description.replace(/"/g, '""')}"`,
          `Status Code,${item.status_code || ''}`,
          `Duration (ms),${item.duration_ms}`,
          `Timestamp,${item.timestamp}`,
          `Headings Count,${item.headings.length}`,
          `Paragraphs Count,${item.paragraphs.length}`,
          `Links Count,${item.links.length}`,
          `Images Count,${item.images.length}`,
        ].join('\n');
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${item.id}_${type}.csv"`);
      return res.send(csvContent);
    }

    // Default JSON
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${item.id}.json"`);
    return res.json(item);
  });

  // API: Get logs
  app.get('/api/logs', (_req: Request, res: Response) => {
    return res.json(logsStore);
  });

  // API: Config
  app.get('/api/config', (_req: Request, res: Response) => {
    return res.json(config);
  });

  app.post('/api/config', (req: Request, res: Response) => {
    if (req.body.user_agent) config.user_agent = String(req.body.user_agent);
    if (req.body.timeout_ms) config.timeout_ms = Number(req.body.timeout_ms);
    if (req.body.delay_seconds) config.delay_seconds = Number(req.body.delay_seconds);
    if (typeof req.body.respect_robots === 'boolean') config.respect_robots = req.body.respect_robots;
    log('INFO', 'config', 'Scraper configuration updated');
    return res.json(config);
  });

  // Seed sample initial run for instant demonstration
  const sampleData = extractAll(
    `<!doctype html>
<html>
<head>
    <title>Example Domain</title>
    <meta charset="utf-8" />
    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="This domain is for use in illustrative examples in documents." />
</head>
<body>
<div>
    <h1>Example Domain</h1>
    <p>This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.</p>
    <p><a href="https://www.iana.org/domains/example">More information...</a></p>
</div>
</body>
</html>`,
    'https://example.com',
    'https://example.com/',
    200,
    142,
    'text/html',
    false
  );
  historyStore.set(sampleData.id, sampleData);

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const PORT = 3000;
  const HOST = '0.0.0.0';

  app.listen(PORT, HOST, () => {
    log('INFO', 'server', `WebScraper application listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
