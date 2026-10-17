import { RobotsMatcher } from 'google-robotstxt-parser';
import { safeFetch, type SafeResponse } from './server-security.ts';

export interface RobotsDecision {
  allowed: boolean;
  statusCode: number | null;
  crawlDelayMs: number;
  source: 'rules' | 'not-found' | 'client-error' | 'unavailable' | 'disabled';
}

export type RobotsFetcher = (
  url: string,
  options: { timeoutMs: number; maxBytes: number; signal?: AbortSignal; userAgent: string },
) => Promise<SafeResponse>;

const MAX_CRAWL_DELAY_MS = 60_000;
const MAX_CACHE_ENTRIES = 200;
interface CachedRobots {
  expiresAt: number;
  decision: RobotsDecision;
  body: string;
}

const cache = new Map<string, CachedRobots>();
const inFlight = new Map<string, Promise<CachedRobots>>();
const originGates = new Map<string, { tail: Promise<void>; lastStartedAt: number; users: number }>();

function cacheDecision(origin: string, entry: CachedRobots) {
  if (!cache.has(origin) && cache.size >= MAX_CACHE_ENTRIES) {
    for (const [cachedOrigin, cached] of cache) {
      if (cached.expiresAt <= Date.now()) cache.delete(cachedOrigin);
    }
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = Array.from(cache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0];
      if (oldest) cache.delete(oldest[0]);
    }
  }
  cache.set(origin, entry);
}

function robotsProductToken(userAgent: string): string {
  return userAgent.trim().split(/[\s/]/, 1)[0] || 'WebScrapperBot';
}

function getCrawlDelay(text: string, userAgent: string): number {
  const crawler = robotsProductToken(userAgent).toLowerCase();
  const groups: Array<{ agents: string[]; delays: string[] }> = [];
  let group = { agents: [] as string[], delays: [] as string[] };
  let hasRules = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#', 1)[0].trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === 'user-agent') {
      if (hasRules && group.agents.length > 0) {
        groups.push(group);
        group = { agents: [], delays: [] };
        hasRules = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (name === 'crawl-delay') {
      group.delays.push(value);
      hasRules = true;
    } else if (name === 'allow' || name === 'disallow' || name === 'sitemap') {
      hasRules = true;
    }
  }
  if (group.agents.length > 0) groups.push(group);

  const specific = groups
    .map((candidate) => ({
      ...candidate,
      specificity: Math.max(0, ...candidate.agents
        .filter((agent) => agent !== '*' && agent && crawler.includes(agent))
        .map((agent) => agent.length)),
    }))
    .filter((candidate) => candidate.specificity > 0)
    .sort((a, b) => b.specificity - a.specificity)[0];
  const selected = specific || groups.find((candidate) => candidate.agents.includes('*'));
  const delaySeconds = selected?.delays
    .map((delay) => Number(delay))
    .filter((delay) => Number.isFinite(delay) && delay >= 0)
    .sort((a, b) => b - a)[0];

  return delaySeconds === undefined ? 0 : Math.min(delaySeconds * 1000, MAX_CRAWL_DELAY_MS);
}

export function createRobotsPolicy(fetcher: RobotsFetcher = safeFetch) {
  async function load(origin: string, userAgent: string, signal?: AbortSignal): Promise<CachedRobots> {
    const robotsUrl = new URL('/robots.txt', origin).toString();
    const response = await fetcher(robotsUrl, {
      timeoutMs: 5000,
      maxBytes: 512 * 1024,
      signal,
      userAgent,
    });

    if (response.statusCode === 404) {
      return { expiresAt: 0, body: '', decision: { allowed: true, statusCode: 404, crawlDelayMs: 0, source: 'not-found' } };
    }
    if (response.statusCode >= 400 && response.statusCode < 500) {
      return { expiresAt: 0, body: '', decision: { allowed: true, statusCode: response.statusCode, crawlDelayMs: 0, source: 'client-error' } };
    }
    if (response.statusCode !== 200) {
      return { expiresAt: 0, body: '', decision: { allowed: false, statusCode: response.statusCode, crawlDelayMs: 0, source: 'unavailable' } };
    }

    const matcher = new RobotsMatcher();
    return {
      expiresAt: 0,
      body: response.body,
      decision: {
        allowed: matcher.oneAgentAllowedByRobots(response.body, robotsProductToken(userAgent), origin),
        statusCode: response.statusCode,
        crawlDelayMs: getCrawlDelay(response.body, userAgent),
        source: 'rules',
      },
    };
  }

  function decisionFor(cached: CachedRobots, targetUrl: string, userAgent: string): RobotsDecision {
    if (cached.decision.source !== 'rules') return cached.decision;
    const matcher = new RobotsMatcher();
    return {
      ...cached.decision,
      allowed: matcher.oneAgentAllowedByRobots(cached.body, robotsProductToken(userAgent), targetUrl),
      crawlDelayMs: getCrawlDelay(cached.body, userAgent),
    };
  }

  return {
    async check(targetUrl: string, userAgent: string, signal?: AbortSignal): Promise<RobotsDecision> {
      const target = new URL(targetUrl);
      const origin = target.origin;
      const cached = cache.get(origin);
      if (cached && cached.expiresAt > Date.now()) {
        return decisionFor(cached, targetUrl, userAgent);
      }

      let pending = inFlight.get(origin);
      if (!pending) {
        pending = load(origin, userAgent, signal)
          .catch((): CachedRobots => ({
            expiresAt: 0,
            body: '',
            decision: { allowed: false, statusCode: null, crawlDelayMs: 0, source: 'unavailable' },
          }))
          .then((entry) => {
            const ttl = entry.decision.source === 'rules' ? 12 * 60 * 60 * 1000
              : entry.decision.source === 'not-found' || entry.decision.source === 'client-error' ? 60 * 60 * 1000
                : 30 * 1000;
            const cachedEntry = { ...entry, expiresAt: Date.now() + ttl };
            cacheDecision(origin, cachedEntry);
            return cachedEntry;
          })
          .finally(() => inFlight.delete(origin));
        inFlight.set(origin, pending);
      }

      return decisionFor(await pending, targetUrl, userAgent);
    },
    clearCache() {
      cache.clear();
      inFlight.clear();
    },
  };
}

export async function runAtOrigin<T>(
  url: string,
  minimumDelayMs: number,
  operation: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const origin = new URL(url).origin;
  let gate = originGates.get(origin);
  if (!gate) {
    gate = { tail: Promise.resolve(), lastStartedAt: 0, users: 0 };
    originGates.set(origin, gate);
  }
  gate.users += 1;
  const previous = gate.tail;
  let release!: () => void;
  gate.tail = new Promise<void>((resolve) => { release = resolve; });
  await previous;

  try {
    const waitMs = Math.max(0, minimumDelayMs - (Date.now() - gate.lastStartedAt));
    if (waitMs > 0) {
      await new Promise<void>((resolve, reject) => {
        let timer: NodeJS.Timeout;
        const cleanup = () => signal?.removeEventListener('abort', abort);
        const abort = () => {
          clearTimeout(timer);
          cleanup();
          reject(new Error('Request was cancelled.'));
        };
        timer = setTimeout(() => {
          cleanup();
          resolve();
        }, waitMs);
        if (signal?.aborted) abort();
        signal?.addEventListener('abort', abort, { once: true });
      });
    }
    gate.lastStartedAt = Date.now();
    return await operation();
  } finally {
    release();
    gate.users -= 1;
    if (gate.users === 0) originGates.delete(origin);
  }
}