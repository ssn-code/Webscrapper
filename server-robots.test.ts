import assert from 'node:assert/strict';
import test from 'node:test';
import { createRobotsPolicy, runAtOrigin } from './server-robots.ts';
import type { SafeResponse } from './server-security.ts';

function response(statusCode: number, body = ''): SafeResponse {
  return {
    url: 'https://example.com/robots.txt',
    statusCode,
    headers: {},
    body,
  };
}

test('robots matching honors allow precedence, end anchors, and crawl-delay', async () => {
  const body = [
    'User-agent: *',
    'Disallow: /private',
    'Allow: /private/open$',
    'Crawl-delay: 1.5',
  ].join('\n');
  const policy = createRobotsPolicy(async () => response(200, body));
  policy.clearCache();

  const denied = await policy.check('https://example.com/private/page', 'WebScrapperBot/1.0');
  const allowed = await policy.check('https://example.com/private/open', 'WebScrapperBot/1.0');
  const prefixDenied = await policy.check('https://example.com/private/open/child', 'WebScrapperBot/1.0');

  assert.equal(denied.allowed, false);
  assert.equal(allowed.allowed, true);
  assert.equal(prefixDenied.allowed, false);
  assert.equal(denied.crawlDelayMs, 1500);
});

test('robots rules are cached and duplicate concurrent fetches are coalesced', async () => {
  let fetchCount = 0;
  const policy = createRobotsPolicy(async () => {
    fetchCount += 1;
    await new Promise(resolve => setTimeout(resolve, 5));
    return response(200, 'User-agent: *\nDisallow: /private');
  });
  policy.clearCache();

  const results = await Promise.all([
    policy.check('https://example.com/private/a', 'WebScrapperBot/1.0'),
    policy.check('https://example.com/private/b', 'WebScrapperBot/1.0'),
  ]);
  await policy.check('https://example.com/public', 'WebScrapperBot/1.0');

  assert.equal(fetchCount, 1);
  assert.deepEqual(results.map(result => result.allowed), [false, false]);
});

test('robots policy matches the configured outbound crawler identity', async () => {
  const policy = createRobotsPolicy(async (_url, options) => {
    assert.equal(options.userAgent, 'CustomAuditBot/2.0');
    return response(200, 'User-agent: CustomAuditBot\nDisallow: /\n\nUser-agent: *\nAllow: /');
  });
  policy.clearCache();

  const decision = await policy.check('https://custom.example/private', 'CustomAuditBot/2.0');
  assert.equal(decision.allowed, false);
});

test('robots 404 and other 4xx allow, while server failures fail closed', async () => {
  const notFound = createRobotsPolicy(async () => response(404));
  notFound.clearCache();
  const forbidden = createRobotsPolicy(async () => response(403));
  const unavailable = createRobotsPolicy(async () => response(503));

  assert.equal((await notFound.check('https://example.com/a', 'WebScrapperBot/1.0')).allowed, true);
  forbidden.clearCache();
  assert.equal((await forbidden.check('https://example.com/b', 'WebScrapperBot/1.0')).allowed, true);
  unavailable.clearCache();
  assert.equal((await unavailable.check('https://example.com/c', 'WebScrapperBot/1.0')).allowed, false);
});

test('same-origin operations are serialized', async () => {
  let active = 0;
  let maximumActive = 0;
  const operation = async () => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
  };

  await Promise.all([
    runAtOrigin('https://example.com/a', 0, operation),
    runAtOrigin('https://example.com/b', 0, operation),
    runAtOrigin('https://example.com/c', 0, operation),
  ]);

  assert.equal(maximumActive, 1);
});