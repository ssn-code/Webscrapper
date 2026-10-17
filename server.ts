import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import * as cheerio from 'cheerio';
import path from 'path';
import { safeFetch, TargetValidationError, validatePublicUrl } from './server-security.ts';
import { createRobotsPolicy, runAtOrigin, type RobotsDecision } from './server-robots.ts';
import { csvCell } from './server-exports.ts';

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

interface SeoMetadata {
  title_tag: string;
  description_tag: string;
  canonical_url: string;
  robots_directives: string;
  viewport: string;
  open_graph: Record<string, string>;
  twitter: Record<string, string>;
  language: string;
  has_doctype: boolean;
  has_html: boolean;
  has_head: boolean;
  has_body: boolean;
  missing_alt_count: number;
  missing_anchor_text_count: number;
  duplicate_link_count: number;
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
  seo_metadata: SeoMetadata;
  custom_selector?: CustomSelectorResult;
  raw_html?: string | null;
  status_code: number | null;
  content_type?: string;
  content_length_bytes?: number;
  robots_allowed?: boolean;
  robots_status?: RobotsDecision['source'];
  duration_ms: number;
  timestamp: string;
}

interface ScraperConfig {
  user_agent: string;
  timeout_ms: number;
  delay_seconds: number;
  respect_robots: boolean;
}

const configuredTimeout = Number.parseInt(process.env.SCRAPER_TIMEOUT || '', 10);
const configuredUserAgent = process.env.SCRAPER_USER_AGENT || 'WebScrapperBot/1.0';
const config: ScraperConfig = {
  user_agent: configuredUserAgent.length <= 160 && !/[\u0000-\u001f\u007f]/.test(configuredUserAgent)
    ? configuredUserAgent
    : 'WebScrapperBot/1.0',
  timeout_ms: Number.isFinite(configuredTimeout)
    ? Math.min(Math.max(configuredTimeout, 1000), 30_000)
    : 30_000,
  delay_seconds: 1,
  respect_robots: true,
};

interface HistoryRecord {
  item: ScrapedData;
  owner: string;
  storedAt: number;
}

const historyStore = new Map<string, HistoryRecord>();
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_HISTORY_ITEMS = 200;
const MAX_HISTORY_PER_SESSION = 20;
const SESSION_COOKIE = 'webscrapper_session';
const MAX_RAW_HTML_BYTES = 512 * 1024;
const MAX_EXTRACTED_ITEMS = 100;
const MAX_EXTRACTED_TEXT_LENGTH = 1000;
const robotsPolicy = createRobotsPolicy();

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

function normalizeUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0 || rawUrl.length > 2048) {
    throw new Error('Enter a URL between 1 and 2048 characters.');
  }
  const cleaned = rawUrl.trim();
  const candidate = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Enter a valid URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }
  return parsed.toString();
}

function readSessionId(req: Request): string | undefined {
  const cookie = req.headers.cookie?.split(';').map(value => value.trim())
    .find(value => value.startsWith(`${SESSION_COOKIE}=`));
  const sessionId = cookie?.slice(SESSION_COOKIE.length + 1);
  return sessionId && /^[A-Za-z0-9_-]{43}$/.test(sessionId) ? sessionId : undefined;
}

function pruneHistory() {
  const cutoff = Date.now() - HISTORY_TTL_MS;
  for (const [id, record] of historyStore) {
    if (record.storedAt < cutoff) historyStore.delete(id);
  }
}

function storeHistoryItem(owner: string, item: ScrapedData) {
  pruneHistory();
  historyStore.set(item.id, { item, owner, storedAt: Date.now() });
  const owned = Array.from(historyStore.entries())
    .filter(([, record]) => record.owner === owner)
    .sort((a, b) => a[1].storedAt - b[1].storedAt);
  while (owned.length > MAX_HISTORY_PER_SESSION) {
    const oldest = owned.shift();
    if (oldest) historyStore.delete(oldest[0]);
  }
  while (historyStore.size > MAX_HISTORY_ITEMS) {
    const oldestId = historyStore.keys().next().value;
    if (oldestId) historyStore.delete(oldestId);
  }
}

function getOwnedHistory(id: string, owner: string): ScrapedData | undefined {
  pruneHistory();
  const record = historyStore.get(id);
  return record?.owner === owner ? record.item : undefined;
}

function createRateLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: express.NextFunction) => {
    const key = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (buckets.size > 2000) {
      for (const [address, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(address);
      }
      while (buckets.size > 2000) {
        const oldestAddress = buckets.keys().next().value;
        if (!oldestAddress) break;
        buckets.delete(oldestAddress);
      }
    }
    if (bucket.count > limit) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Request rate limit exceeded. Please retry shortly.' });
    }
    next();
  };
}

function isAdmin(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const provided = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || !provided) return false;
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

interface ScrapeWaiter {
  response: Response;
  resolve: (release: (() => void) | null) => void;
  onClose: () => void;
}

let activeScrapes = 0;
const scrapeQueue: ScrapeWaiter[] = [];
const MAX_ACTIVE_SCRAPES = 4;
const MAX_QUEUED_SCRAPES = 16;

function makeScrapeRelease(): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = scrapeQueue.shift();
    if (next) {
      next.response.off('close', next.onClose);
      next.resolve(makeScrapeRelease());
    } else {
      activeScrapes -= 1;
    }
  };
}

function acquireScrapeSlot(response: Response): Promise<(() => void) | null> {
  if (activeScrapes < MAX_ACTIVE_SCRAPES) {
    activeScrapes += 1;
    return Promise.resolve(makeScrapeRelease());
  }
  if (scrapeQueue.length >= MAX_QUEUED_SCRAPES) return Promise.resolve(null);
  if (response.destroyed) return Promise.resolve(null);
  return new Promise((resolve) => {
    const waiter: ScrapeWaiter = {
      response,
      resolve,
      onClose: () => {
        if (response.writableEnded) return;
        const index = scrapeQueue.indexOf(waiter);
        if (index >= 0) scrapeQueue.splice(index, 1);
        resolve(null);
      },
    };
    response.on('close', waiter.onClose);
    scrapeQueue.push(waiter);
  });
}

function extractAll(
  html: string,
  originalUrl: string,
  finalUrl: string,
  statusCode: number | null,
  durationMs: number,
  contentType: string,
  includeHtml: boolean,
  customSelector?: string,
  robotsDecision?: RobotsDecision,
): ScrapedData {
  const $ = cheerio.load(html || '');
  const baseUrl = finalUrl || originalUrl;

  // Title extraction with fallbacks
  let title = $('title').first().text().trim().slice(0, 2000);
  if (!title) {
    title = $('meta[property="og:title"]').attr('content')?.trim().slice(0, 2000) || '';
  }
  if (!title) {
    title = $('h1').first().text().trim().slice(0, 2000) || '';
  }

  // Meta description extraction with fallbacks
  let meta_description = $('meta[name="description" i]').attr('content')?.trim().slice(0, 5000) || '';
  if (!meta_description) {
    meta_description = $('meta[property="og:description"]').attr('content')?.trim().slice(0, 5000) || '';
  }

  // Headings
  const headings: HeadingItem[] = [];
  $('h1, h2, h3, h4, h5, h6').slice(0, MAX_EXTRACTED_ITEMS).each((_, el) => {
    const tagName = el.tagName.toLowerCase();
    const level = parseInt(tagName.replace('h', ''), 10);
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text && !isNaN(level)) {
      headings.push({ level, text: text.slice(0, MAX_EXTRACTED_TEXT_LENGTH) });
    }
  });

  // Paragraphs
  const paragraphs: string[] = [];
  $('p').slice(0, MAX_EXTRACTED_ITEMS).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text) {
      paragraphs.push(text.slice(0, MAX_EXTRACTED_TEXT_LENGTH));
    }
  });

  // Links
  const links: LinkItem[] = [];
  const seenLinks = new Set<string>();
  const baseDomain = new URL(baseUrl).hostname;

  $('a[href]').slice(0, MAX_EXTRACTED_ITEMS).each((_, el) => {
    const rawHref = $(el).attr('href')?.trim() || '';
    if (!rawHref || /^(#|javascript:|mailto:|tel:)/i.test(rawHref)) {
      return;
    }

    try {
      const resolved = new URL(rawHref, baseUrl);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        const fullHref = resolved.toString();
        const text = ($(el).text().replace(/\s+/g, ' ').trim() || '(No anchor text)')
          .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
        const key = `${fullHref}::${text}`;
        if (!seenLinks.has(key)) {
          seenLinks.add(key);
          const isExternal = resolved.hostname !== baseDomain;
          links.push({
            text,
            href: fullHref.slice(0, 2048),
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
  $('img').slice(0, MAX_EXTRACTED_ITEMS).each((_, el) => {
    const rawSrc = $(el).attr('src')?.trim() || $(el).attr('data-src')?.trim() || '';
    if (!rawSrc || rawSrc.startsWith('data:')) {
      return;
    }


    try {
      const resolved = new URL(rawSrc, baseUrl).toString();
      if (!seenImages.has(resolved)) {
        seenImages.add(resolved);
        const alt = ($(el).attr('alt')?.trim() || '').slice(0, MAX_EXTRACTED_TEXT_LENGTH);
        images.push({
          src: resolved.slice(0, 2048),
          alt,
        });
      }
    } catch {
      // Ignore invalid URL conversions
    }
  });

  const resolveMetadataUrl = (value: string | undefined) => {
    if (!value) return '';
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return '';
    }
  };
  const metadata = (selector: string) => $(selector).first().attr('content')?.trim().slice(0, 2000) || '';
  const openGraph: Record<string, string> = {};
  for (const property of ['og:title', 'og:description', 'og:type', 'og:url', 'og:image']) {
    const value = metadata(`meta[property="${property}" i]`);
    if (value) openGraph[property] = value;
  }
  const twitter: Record<string, string> = {};
  for (const name of ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
    const value = metadata(`meta[name="${name}" i]`);
    if (value) twitter[name] = value;
  }
  const pageLinkTargets: string[] = [];
  $('a[href]').each((_, element) => {
    try {
      const linkUrl = new URL($(element).attr('href') || '', baseUrl);
      if (linkUrl.protocol === 'http:' || linkUrl.protocol === 'https:') {
        linkUrl.hash = '';
        pageLinkTargets.push(linkUrl.toString());
      }
    } catch {
      return;
    }
  });
  const seoMetadata: SeoMetadata = {
    title_tag: $('title').first().text().trim().slice(0, 2000),
    description_tag: $('meta[name="description" i]').first().attr('content')?.trim().slice(0, 5000) || '',
    canonical_url: resolveMetadataUrl($('link[rel="canonical" i]').first().attr('href')),
    robots_directives: metadata('meta[name="robots" i]') || metadata('meta[name="googlebot" i]'),
    viewport: metadata('meta[name="viewport" i]'),
    open_graph: openGraph,
    twitter,
    language: $('html').attr('lang')?.trim().slice(0, 100) || '',
    has_doctype: /^\s*<!doctype\s+html/i.test(html),
    has_html: /<html\b/i.test(html),
    has_head: /<head\b/i.test(html),
    has_body: /<body\b/i.test(html),
    missing_alt_count: $('img').filter((_, el) => !($(el).attr('alt') || '').trim()).length,
    missing_anchor_text_count: $('a[href]').filter((_, el) => !($(el).text() || '').trim() && !$(el).find('img[alt]').length).length,
    duplicate_link_count: Math.max(0, pageLinkTargets.length - new Set(pageLinkTargets).size),
  };

  // Custom Selector Extraction
  let customResult: CustomSelectorResult | undefined = undefined;
  if (customSelector && customSelector.trim()) {
    try {
      const matched = $(customSelector);
      const items: Array<{ text: string; html: string; attributes: Record<string, string> }> = [];
      matched.slice(0, 20).each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim().slice(0, MAX_EXTRACTED_TEXT_LENGTH);
        const innerHtml = ($(el).html()?.trim() || '').slice(0, 1000);
        const attributes: Record<string, string> = {};
        if ('attribs' in el && el.attribs) {
          Object.entries(el.attribs).slice(0, 20).forEach(([name, value]) => {
            attributes[name.slice(0, 100)] = value.slice(0, 256);
          });
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
    seo_metadata: seoMetadata,
    custom_selector: customResult,
    raw_html: includeHtml
      ? Buffer.from(html, 'utf8').subarray(0, MAX_RAW_HTML_BYTES).toString('utf8')
      : null,
    status_code: statusCode,
    content_type: contentType,
    content_length_bytes: Buffer.byteLength(html, 'utf-8'),
    robots_allowed: robotsDecision?.allowed,
    robots_status: robotsDecision?.source,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();
  const historyCleanup = setInterval(pruneHistory, 15 * 60 * 1000);
  historyCleanup.unref();
  const allowedOrigins = new Set((process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',').map(origin => origin.trim()).filter(Boolean));
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false }));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, Boolean(origin && allowedOrigins.has(origin)));
    },
  }));
  app.use((req: Request, res: Response, next: express.NextFunction) => {
    let sessionId = readSessionId(req);
    if (!sessionId) {
      sessionId = randomBytes(32).toString('base64url');
      const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
      res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`);
    }
    res.locals.sessionId = sessionId;
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use('/api', createRateLimiter(120, 60_000));
  app.use('/api', (_req: Request, res: Response, next: express.NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (_req: Request, res: Response) => res.json({ status: 'ok' }));

  // API: Scrape endpoint
  app.post('/api/scrape', createRateLimiter(15, 60_000), async (req: Request, res: Response) => {
    const startTime = Date.now();
    if (!req.is('application/json')) {
      return res.status(415).json({ error: 'Content-Type must be application/json.' });
    }
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'A JSON object is required.' });
    }
    const { url, selector, timeout, include_html } = body;
    let targetUrl: string;
    try {
      targetUrl = normalizeUrl(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Enter a valid URL.';
      return res.status(400).json({ error: message });
    }

    if (selector !== undefined && (typeof selector !== 'string' || selector.length > 300)) {
      return res.status(400).json({ error: 'CSS selector must be a string of at most 300 characters.' });
    }
    if (selector) {
      try {
        cheerio.load('')(selector);
      } catch {
        return res.status(400).json({ error: 'The CSS selector is invalid.' });
      }
    }
    if (include_html !== undefined && typeof include_html !== 'boolean') {
      return res.status(400).json({ error: 'include_html must be a boolean.' });
    }
    if (timeout !== undefined && (typeof timeout !== 'number' || !Number.isFinite(timeout))) {
      return res.status(400).json({ error: 'timeout must be a number of milliseconds.' });
    }
    const timeoutMs = Math.min(Math.max(Math.floor(timeout ?? config.timeout_ms), 1000), 30_000);
    const release = await acquireScrapeSlot(res);
    if (!release) {
      return res.status(503).json({ error: 'Scrape capacity is full. Please retry shortly.' });
    }

    const controller = new AbortController();
    const abortIfDisconnected = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', abortIfDisconnected);
    try {
      try {
        await validatePublicUrl(targetUrl, undefined, controller.signal);
      } catch (error) {
        if (error instanceof TargetValidationError) {
          return res.status(400).json({ error: error.message, code: 'TARGET_BLOCKED' });
        }
        throw error;
      }
      let robotsDecision: RobotsDecision;
      if (config.respect_robots) {
        robotsDecision = await runAtOrigin(
          targetUrl,
          config.delay_seconds * 1000,
          () => robotsPolicy.check(targetUrl, config.user_agent, controller.signal),
          controller.signal,
        );
        if (!robotsDecision.allowed) {
          throw new Error(robotsDecision.source === 'unavailable' ? 'ROBOTS_UNAVAILABLE' : 'ROBOTS_DISALLOWED');
        }
      } else {
        robotsDecision = { allowed: true, statusCode: null, crawlDelayMs: 0, source: 'disabled' };
      }

      const response = await runAtOrigin(
        targetUrl,
        Math.max(config.delay_seconds * 1000, robotsDecision.crawlDelayMs),
        () => safeFetch(targetUrl, {
          timeoutMs,
          maxBytes: 2 * 1024 * 1024,
          signal: controller.signal,
          userAgent: config.user_agent,
        }),
        controller.signal,
      );

      const durationMs = Date.now() - startTime;
      const finalUrl = response.url;
      const statusCode = response.statusCode;
      const contentType = String(response.headers['content-type'] || '');
      if (!/^text\/html\b|^application\/xhtml\+xml\b/i.test(contentType)) {
        return res.status(415).json({ error: 'The target did not return an HTML document.' });
      }
      const html = response.body;

      log('INFO', 'scraper', `HTTP ${statusCode} in ${durationMs}ms`);

      const scrapedData = extractAll(
        html,
        targetUrl,
        finalUrl,
        statusCode,
        durationMs,
        contentType,
        include_html === true,
        selector,
        robotsDecision
      );

      storeHistoryItem(res.locals.sessionId, scrapedData);

      log(
        'INFO',
        'extractor',
        `Extracted ${scrapedData.headings.length} headings, ${scrapedData.paragraphs.length} paragraphs, ${scrapedData.links.length} links, and ${scrapedData.images.length} images`
      );

      return res.json(scrapedData);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const detail = error instanceof Error ? error.message : '';
      const timedOut = /timed out/i.test(detail);
      const robotsDisallowed = detail === 'ROBOTS_DISALLOWED';
      const robotsUnavailable = detail === 'ROBOTS_UNAVAILABLE';
      const tooLarge = /exceeds the \d+-byte limit/i.test(detail);
      const blocked = error instanceof TargetValidationError || /public IP addresses|Local and reserved|standard HTTP and HTTPS ports|Only HTTP and HTTPS|Single-label|credentials are not allowed/i.test(detail);
      const status = robotsDisallowed ? 403 : robotsUnavailable ? 503 : tooLarge ? 413 : blocked ? 400 : timedOut ? 504 : 502;
      const message = robotsDisallowed
        ? 'Scraping is disallowed by this site\'s robots.txt rules.'
        : robotsUnavailable
          ? 'The site\'s robots.txt could not be reached, so scraping was blocked.'
          : tooLarge
        ? 'The target response exceeded the 2 MB limit.'
        : blocked
          ? detail
          : timedOut
            ? 'The target request timed out.'
            : 'The target could not be fetched. Check that it is publicly reachable and try again.';
      log('WARN', 'scraper', `Scrape failed (${status}) after ${durationMs}ms`);
      if (res.destroyed) return;
      return res.status(status).json({
        error: message,
        code: robotsDisallowed ? 'ROBOTS_DISALLOWED' : robotsUnavailable ? 'ROBOTS_UNAVAILABLE' : tooLarge ? 'RESPONSE_TOO_LARGE' : blocked ? 'TARGET_BLOCKED' : timedOut ? 'TIMEOUT' : 'SCRAPE_FAILED',
        duration_ms: durationMs,
      });
    } finally {
      res.off('close', abortIfDisconnected);
      release();
    }
  });

  // API: Get history list
  app.get('/api/history', (_req: Request, res: Response) => {
    pruneHistory();
    const owner = res.locals.sessionId as string;
    const list = Array.from(historyStore.values())
      .filter(record => record.owner === owner)
      .map(({ item }) => ({
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
    const item = getOwnedHistory(id, res.locals.sessionId as string);
    if (!item) {
      return res.status(404).json({ error: 'Run not found' });
    }
    return res.json(item);
  });

  // API: Delete single history item
  app.delete('/api/history/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const item = getOwnedHistory(id, res.locals.sessionId as string);
    if (!item) {
      return res.status(404).json({ error: 'Run not found' });
    }
    historyStore.delete(id);
    log('INFO', 'storage', `Deleted run ${id}`);
    return res.json({ success: true, id });
  });

  // API: Clear all history
  app.delete('/api/history', (_req: Request, res: Response) => {
    const owner = res.locals.sessionId as string;
    let count = 0;
    for (const [id, record] of historyStore) {
      if (record.owner === owner) {
        historyStore.delete(id);
        count += 1;
      }
    }
    log('INFO', 'storage', `Cleared all ${count} history runs`);
    return res.json({ success: true, count });
  });

  // API: Export in JSON or CSV
  app.get('/api/export/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const item = getOwnedHistory(id, res.locals.sessionId as string);
    if (!item) {
      return res.status(404).json({ error: 'Run not found' });
    }

    const format = req.query.format === undefined ? 'json' : req.query.format;
    const type = req.query.type === undefined ? 'all' : req.query.type;
    if (typeof format !== 'string' || !['json', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'format must be json or csv.' });
    }
    if (typeof type !== 'string' || !['all', 'summary', 'headings', 'links', 'images', 'paragraphs'].includes(type)) {
      return res.status(400).json({ error: 'Unsupported CSV export type.' });
    }

    if (format === 'csv') {
      let csvContent = '';
      if (type === 'headings') {
        csvContent = 'Level,Heading Text\n' + item.headings
          .map(h => `${h.level},${csvCell(h.text)}`)
          .join('\n');
      } else if (type === 'links') {
        csvContent = 'Anchor Text,Href,Is External\n' + item.links
          .map(l => `${csvCell(l.text)},${csvCell(l.href)},${l.isExternal}`)
          .join('\n');
      } else if (type === 'images') {
        csvContent = 'Source URL,Alt Text\n' + item.images
          .map(i => `${csvCell(i.src)},${csvCell(i.alt)}`)
          .join('\n');
      } else if (type === 'paragraphs') {
        csvContent = 'Index,Paragraph Text\n' + item.paragraphs
          .map((p, idx) => `${idx + 1},${csvCell(p)}`)
          .join('\n');
      } else {
        // Summary CSV
        csvContent = [
          'Property,Value',
          `URL,${csvCell(item.url)}`,
          `Final URL,${csvCell(item.final_url)}`,
          `Title,${csvCell(item.title)}`,
          `Meta Description,${csvCell(item.meta_description)}`,
          `Status Code,${item.status_code || ''}`,
          `Duration (ms),${item.duration_ms}`,
          `Timestamp,${csvCell(item.timestamp)}`,
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

  app.post('/api/links/check', createRateLimiter(3, 60_000), async (req: Request, res: Response) => {
    if (!req.is('application/json') || typeof req.body?.id !== 'string' || req.body.id.length > 100) {
      return res.status(400).json({ error: 'A scrape run id is required.' });
    }
    const item = getOwnedHistory(req.body.id, res.locals.sessionId as string);
    if (!item) return res.status(404).json({ error: 'Run not found.' });

    const linksByUrl = new Map<string, LinkItem>();
    for (const link of item.links) {
      try {
        const normalized = new URL(link.href);
        normalized.hash = '';
        linksByUrl.set(normalized.toString(), { ...link, href: normalized.toString() });
      } catch {
        continue;
      }
      if (linksByUrl.size >= 25) break;
    }

    const controller = new AbortController();
    const abortIfDisconnected = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', abortIfDisconnected);
    let release: (() => void) | undefined;
    try {
      release = await acquireScrapeSlot(res) || undefined;
      if (!release) return res.status(503).json({ error: 'Link-check capacity is full. Please retry shortly.' });
      const links = Array.from(linksByUrl.values());
      const results: Array<{
        url: string;
        text: string;
        isExternal: boolean;
        status_code: number | null;
        final_url: string;
        method: 'HEAD' | 'GET';
        error?: string;
      } | undefined> = new Array(links.length);
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < links.length && !controller.signal.aborted) {
          const index = nextIndex;
          nextIndex += 1;
          const link = links[index];
          try {
            await validatePublicUrl(link.href, undefined, controller.signal);
            const policy = await runAtOrigin(link.href, config.delay_seconds * 1000, () => (
              robotsPolicy.check(link.href, config.user_agent, controller.signal)
            ), controller.signal);
            if (!policy.allowed) {
              results[index] = {
                url: link.href,
                text: link.text,
                isExternal: link.isExternal,
                status_code: policy.statusCode,
                final_url: link.href,
                method: 'HEAD',
                error: policy.source === 'unavailable' ? 'robots.txt unavailable; check skipped' : 'disallowed by robots.txt',
              };
              continue;
            }
            let response = await runAtOrigin(link.href, Math.max(config.delay_seconds * 1000, policy.crawlDelayMs), () => (
              safeFetch(link.href, {
                timeoutMs: 4000,
                maxBytes: 32 * 1024,
                signal: controller.signal,
                userAgent: config.user_agent,
                method: 'HEAD',
              })
            ), controller.signal);
            let method: 'HEAD' | 'GET' = 'HEAD';
            if (response.statusCode === 405 || response.statusCode === 501) {
              response = await runAtOrigin(link.href, Math.max(config.delay_seconds * 1000, policy.crawlDelayMs), () => (
                safeFetch(link.href, {
                  timeoutMs: 4000,
                  maxBytes: 32 * 1024,
                  signal: controller.signal,
                  userAgent: config.user_agent,
                  method: 'GET',
                })
              ), controller.signal);
              method = 'GET';
            }
            results[index] = {
              url: link.href,
              text: link.text,
              isExternal: link.isExternal,
              status_code: response.statusCode,
              final_url: response.url,
              method,
            };
          } catch (error) {
            if (controller.signal.aborted) return;
            results[index] = {
              url: link.href,
              text: link.text,
              isExternal: link.isExternal,
              status_code: null,
              final_url: link.href,
              method: 'HEAD',
              error: error instanceof Error && /timed out/i.test(error.message)
                ? 'request timed out'
                : 'request failed or target was blocked by security policy',
            };
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, links.length) }, worker));
      if (controller.signal.aborted || res.destroyed) return;
      return res.json({ checked: results.filter(Boolean).length, limit: 25, results: results.filter(Boolean) });
    } finally {
      res.off('close', abortIfDisconnected);
      release?.();
    }
  });

  // API: Get logs
  app.get('/api/logs', (_req: Request, res: Response) => {
    if (!isAdmin(_req)) {
      return res.status(process.env.ADMIN_TOKEN ? 401 : 503).json({ error: 'Administrator authorization required.' });
    }
    return res.json(logsStore);
  });

  // API: Config
  app.get('/api/config', (_req: Request, res: Response) => {
    return res.json(config);
  });

  app.post('/api/config', (req: Request, res: Response) => {
    if (!process.env.ADMIN_TOKEN) {
      return res.status(503).json({ error: 'Administrator configuration is disabled until ADMIN_TOKEN is set.' });
    }
    if (!isAdmin(req)) return res.status(401).json({ error: 'Administrator authorization required.' });
    if (!req.is('application/json') || !req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(415).json({ error: 'A JSON configuration object is required.' });
    }
    const allowedKeys = new Set(['user_agent', 'timeout_ms', 'delay_seconds', 'respect_robots']);
    if (Object.keys(req.body).some(key => !allowedKeys.has(key))) {
      return res.status(400).json({ error: 'Configuration contains an unsupported setting.' });
    }
    if (req.body.user_agent !== undefined) {
      if (typeof req.body.user_agent !== 'string' || req.body.user_agent.length > 160 || /[\u0000-\u001f\u007f]/.test(req.body.user_agent)) {
        return res.status(400).json({ error: 'User-Agent must be plain text with at most 160 characters.' });
      }
      config.user_agent = req.body.user_agent.trim() || 'WebScrapperBot/1.0';
    }
    if (req.body.timeout_ms !== undefined) {
      if (typeof req.body.timeout_ms !== 'number' || !Number.isFinite(req.body.timeout_ms)) {
        return res.status(400).json({ error: 'timeout_ms must be a number.' });
      }
      config.timeout_ms = Math.min(Math.max(Math.floor(req.body.timeout_ms), 1000), 30_000);
    }
    if (req.body.delay_seconds !== undefined) {
      if (typeof req.body.delay_seconds !== 'number' || !Number.isFinite(req.body.delay_seconds)) {
        return res.status(400).json({ error: 'delay_seconds must be a number.' });
      }
      config.delay_seconds = Math.min(Math.max(req.body.delay_seconds, 0), 10);
    }
    if (req.body.respect_robots !== undefined) {
      if (typeof req.body.respect_robots !== 'boolean') {
        return res.status(400).json({ error: 'respect_robots must be a boolean.' });
      }
      config.respect_robots = req.body.respect_robots;
    }
    log('INFO', 'config', 'Scraper configuration updated');
    return res.json(config);
  });

  app.use('/api', (_req: Request, res: Response) => {
    return res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use((error: { status?: number; type?: string }, req: Request, res: Response, _next: express.NextFunction) => {
    if (!req.path.startsWith('/api')) return res.status(500).send('Internal server error.');
    const status = error.status === 413 || error.type === 'entity.too.large' ? 413 : 400;
    return res.status(status).json({ error: status === 413 ? 'Request body exceeds the 32 KB limit.' : 'Request body must contain valid JSON.' });
  });

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

  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  app.listen(PORT, HOST, () => {
    log('INFO', 'server', `WebScraper application listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
