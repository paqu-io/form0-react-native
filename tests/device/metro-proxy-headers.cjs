// Device harness only. Metro expects one forwarded origin, not a comma-separated proxy chain.
function validOrigin(protocol, host) {
  try {
    const url = new URL(protocol + '://' + host);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function normalizeMetroProxyHeaders(request) {
  const headers = request.headers;
  const host = headers['x-forwarded-host'] || headers.host;
  const protocol = headers['x-forwarded-proto'] || (request.socket?.encrypted ? 'https' : 'http');
  if (validOrigin(protocol, host)) return null;
  const hostTokens = typeof host === 'string' ? host.split(',').map((value) => value.trim()) : [];
  const protocolTokens =
    typeof protocol === 'string' ? protocol.split(',').map((value) => value.trim()) : [];
  const chain =
    (typeof headers['x-forwarded-host'] === 'string' && hostTokens.length > 1) ||
    (typeof headers['x-forwarded-proto'] === 'string' && protocolTokens.length > 1);
  const report = {
    type: 'metro-forwarded-origin',
    status: 'unhandled-invalid-origin',
    hostTokens: hostTokens.length,
    protocolTokens: protocolTokens.length,
  };
  if (
    !chain ||
    !protocolTokens.every((value) => /^(http|https)$/i.test(value)) ||
    !hostTokens.every((value) => validOrigin('http', value)) ||
    !validOrigin(protocolTokens[0], hostTokens[0])
  )
    return report;
  if (headers['x-forwarded-host']) headers['x-forwarded-host'] = hostTokens[0];
  if (headers['x-forwarded-proto']) headers['x-forwarded-proto'] = protocolTokens[0];
  return { ...report, status: 'normalized-forwarded-chain' };
}

module.exports = { normalizeMetroProxyHeaders };
