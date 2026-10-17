import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicAddress, safeFetch, validatePublicUrl } from './server-security.ts';

test('public address classifier rejects special-use IPv4 and IPv6 ranges', () => {
  for (const address of [
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '224.0.0.1',
    '0.0.0.0',
    '192.0.2.1',
    '198.51.100.1',
    '203.0.113.1',
    '240.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
  ]) {
    assert.equal(isPublicAddress(address), false, `${address} must not be public`);
  }
  assert.equal(isPublicAddress('93.184.216.34'), true);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('URL validation rejects local targets, non-web protocols, credentials, and nonstandard ports', async () => {
  await assert.rejects(validatePublicUrl('http://127.0.0.1/'));
  await assert.rejects(validatePublicUrl('http://localhost/'));
  await assert.rejects(validatePublicUrl('file:///etc/passwd'));
  await assert.rejects(validatePublicUrl('https://user:secret@example.com/'));
  await assert.rejects(validatePublicUrl('https://example.com:8443/'));
});

test('DNS validation rejects a hostname that resolves to any private address', async () => {
  await assert.rejects(
    validatePublicUrl('https://public-looking.example/', async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.8', family: 4 },
    ]),
    /public IP addresses/,
  );
});

test('URL validation accepts an exclusively public DNS result', async () => {
  const result = await validatePublicUrl('https://example.com/', async () => [
    { address: '93.184.216.34', family: 4 },
  ]);
  assert.equal(result.url.hostname, 'example.com');
  assert.deepEqual(result.addresses, [{ address: '93.184.216.34', family: 4 }]);
});

test('each redirect destination is revalidated before a connection is made', async () => {
  let requestCount = 0;
  await assert.rejects(
    safeFetch('https://public.example/', {
      timeoutMs: 1000,
      maxBytes: 1024,
      request: async (url) => {
        requestCount += 1;
        return {
          url: url.toString(),
          statusCode: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/' },
          body: '',
        };
      },
    }, async () => [{ address: '93.184.216.34', family: 4 }]),
  );
  assert.equal(requestCount, 1);
});

test('overall timeout also bounds a stalled DNS lookup', async () => {
  await assert.rejects(
    safeFetch('https://slow-dns.example/', { timeoutMs: 10, maxBytes: 1024 }, () => new Promise(() => {})),
    /timed out after 10ms/,
  );
});