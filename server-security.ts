import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';
import ipaddr from 'ipaddr.js';

const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 5;

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface SafeResponse {
  url: string;
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: string;
}

export class TargetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TargetValidationError';
  }
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;
export type SafeRequester = (
  url: URL,
  addresses: ResolvedAddress[],
  options: { timeoutMs: number; maxBytes: number; userAgent: string; method: 'GET' | 'HEAD'; signal?: AbortSignal },
) => Promise<SafeResponse>;

function awaitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new Error('Request was cancelled.'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('Request was cancelled.'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function resolveHost(hostname: string): Promise<ResolvedAddress[]> {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
}

export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

export async function validatePublicUrl(
  rawUrl: string,
  resolver: HostResolver = resolveHost,
  signal?: AbortSignal,
): Promise<{ url: URL; addresses: ResolvedAddress[] }> {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > MAX_URL_LENGTH) {
    throw new TargetValidationError(`URL must be between 1 and ${MAX_URL_LENGTH} characters.`);
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TargetValidationError('Enter a valid absolute URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new TargetValidationError('Only HTTP and HTTPS URLs are supported.');
  }
  if (url.username || url.password) {
    throw new TargetValidationError('URLs containing credentials are not allowed.');
  }
  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  if (url.port && url.port !== expectedPort) {
    throw new TargetValidationError('Only standard HTTP and HTTPS ports are allowed.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostname === 'localhost' || /\.(localhost|local|internal|test|invalid)$/.test(hostname)) {
    throw new TargetValidationError('Local and reserved hostnames are not allowed.');
  }

  const literalFamily = ipaddr.isValid(hostname) ? ipaddr.parse(hostname).kind() === 'ipv4' ? 4 : 6 : null;
  if (!literalFamily && !hostname.includes('.')) {
    throw new TargetValidationError('Single-label hostnames are not allowed.');
  }
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await awaitWithSignal(resolver(hostname), signal);

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new TargetValidationError('The URL host must resolve exclusively to public IP addresses.');
  }

  return { url, addresses };
}

function createPinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return ((hostname: string, options: number | { family?: number; all?: boolean }, callback: (...args: any[]) => void) => {
    const family = typeof options === 'number' ? options : options.family;
    const candidates = family ? addresses.filter((entry) => entry.family === family) : addresses;
    if (candidates.length === 0) {
      callback(new Error('No validated address is available for this host.'));
      return;
    }
    if (typeof options === 'object' && options.all) {
      callback(null, candidates);
    } else {
      callback(null, candidates[0].address, candidates[0].family);
    }
  }) as LookupFunction;
}

function requestOnce(
  url: URL,
  addresses: ResolvedAddress[],
  timeoutMs: number,
  maxBytes: number,
  userAgent: string,
  method: 'GET' | 'HEAD',
  signal?: AbortSignal,
): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const agent = url.protocol === 'https:'
      ? new https.Agent({ lookup: createPinnedLookup(addresses), keepAlive: false })
      : new http.Agent({ lookup: createPinnedLookup(addresses), keepAlive: false });
    const request = transport.request(url, {
      method,
      agent,
      lookup: createPinnedLookup(addresses),
      timeout: timeoutMs,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml;q=0.9',
      },
    }, (response) => {
      const statusCode = response.statusCode || 0;
      const chunks: Buffer[] = [];
      let receivedBytes = 0;
      const declaredLength = Number(response.headers['content-length']);
      if (method !== 'HEAD' && Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        response.destroy(new Error(`Response exceeds the ${maxBytes}-byte limit.`));
        return;
      }
      response.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        receivedBytes += buffer.length;
        if (receivedBytes > maxBytes) {
          response.destroy(new Error(`Response exceeds the ${maxBytes}-byte limit.`));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => resolve({
        url: url.toString(),
        statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
      response.on('error', reject);
    });

    const abort = () => request.destroy(new Error('Request was cancelled.'));
    if (signal?.aborted) abort();
    signal?.addEventListener('abort', abort, { once: true });
    request.on('timeout', () => request.destroy(new Error(`Request timed out after ${timeoutMs}ms.`)));
    request.on('error', reject);
    request.on('close', () => {
      signal?.removeEventListener('abort', abort);
      agent.destroy();
    });
    request.end();
  });
}

export async function safeFetch(
  rawUrl: string,
  options: {
    timeoutMs: number;
    maxBytes: number;
    signal?: AbortSignal;
    userAgent?: string;
    method?: 'GET' | 'HEAD';
    request?: SafeRequester;
  },
  resolver: HostResolver = resolveHost,
): Promise<SafeResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);
  let nextUrl = rawUrl;

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      const { url, addresses } = await validatePublicUrl(nextUrl, resolver, controller.signal);
      const requestOptions = {
        timeoutMs: options.timeoutMs,
        maxBytes: options.maxBytes,
        userAgent: options.userAgent || 'WebScrapperBot/1.0',
        method: options.method || 'GET',
        signal: controller.signal,
      };
      const response = await awaitWithSignal(
        options.request
          ? options.request(url, addresses, requestOptions)
          : requestOnce(url, addresses, requestOptions.timeoutMs, requestOptions.maxBytes, requestOptions.userAgent, requestOptions.method, requestOptions.signal),
        controller.signal,
      );
      const location = response.headers.location;
      if (response.statusCode < 300 || response.statusCode >= 400 || !location) return response;
      if (redirects === MAX_REDIRECTS) throw new Error('The target exceeded the redirect limit.');
      nextUrl = new URL(location, url).toString();
    }
  } catch (error) {
    if (timedOut) throw new Error(`Request timed out after ${options.timeoutMs}ms.`);
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  throw new Error('The target exceeded the redirect limit.');
}