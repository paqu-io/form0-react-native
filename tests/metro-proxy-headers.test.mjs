import test from 'node:test';
import assert from 'node:assert/strict';
import helper from './device/metro-proxy-headers.cjs';
const { normalizeMetroProxyHeaders } = helper;
const metroURL = (request) =>
  new URL(
    '/index.bundle?platform=android&dev=false&minify=true',
    (request.headers['x-forwarded-proto'] || 'http') +
      '://' +
      (request.headers['x-forwarded-host'] || request.headers.host)
  );

test('ordinary direct and single-proxy request origins are preserved', () => {
  for (const headers of [
    { host: 'localhost:8081' },
    {
      host: 'localhost:8081',
      'x-forwarded-host': 'example.exp.direct',
      'x-forwarded-proto': 'https',
    },
    { host: '[::1]:8081' },
  ]) {
    const request = { headers: { ...headers } };
    const before = metroURL(request).href;
    assert.equal(normalizeMetroProxyHeaders(request), null);
    assert.deepEqual(request.headers, headers);
    assert.equal(metroURL(request).href, before);
  }
});

for (const [host, protocol] of [
  ['example.exp.direct', 'https, http'],
  ['example.exp.direct, localhost:8081', 'https'],
  ['example.exp.direct, localhost:8081', 'https, http'],
])
  test(`proxy chain constructs the same Metro URL as its first forwarded origin: ${host}/${protocol}`, () => {
    const request = {
      headers: { host: 'localhost:8081', 'x-forwarded-host': host, 'x-forwarded-proto': protocol },
    };
    assert.throws(() => metroURL(request), { code: 'ERR_INVALID_URL' });
    assert.equal(normalizeMetroProxyHeaders(request).status, 'normalized-forwarded-chain');
    assert.equal(
      metroURL(request).href,
      'https://example.exp.direct/index.bundle?platform=android&dev=false&minify=true'
    );
    assert.equal(request.headers.host, 'localhost:8081');
  });

test('other malformed origins remain explicit errors, without exposing their values', () => {
  for (const [host, protocol] of [
    ['bad host', 'https'],
    ['example.exp.direct', 'ftp, https'],
    ['example.exp.direct/path, localhost:8081', 'https'],
    ['example.exp.direct, invalid host', 'https'],
  ]) {
    const headers = {
      host: 'localhost:8081',
      'x-forwarded-host': host,
      'x-forwarded-proto': protocol,
    };
    const request = { headers: { ...headers } };
    const report = normalizeMetroProxyHeaders(request);
    assert.equal(report.status, 'unhandled-invalid-origin');
    assert.deepEqual(request.headers, headers);
    assert.deepEqual(Object.keys(report), ['type', 'status', 'hostTokens', 'protocolTokens']);
  }
});
