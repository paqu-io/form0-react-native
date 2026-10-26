const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createRequire, Module } = require('node:module');

// Harness only. Expo Go caches production assets by manifest key, not by their changed URL.
// Rewrite the installed CLI module in memory before it serializes/signs any manifest.
function withSessionAssetKey(source, key) {
  const anchor = "key: 'bundle',";
  if (!/^form0-phase-[a-zA-Z0-9-]+$/.test(key)) throw new Error('Invalid diagnostic asset key');
  if (source.split(anchor).length !== 2)
    throw new Error('Expo manifest asset-key anchor changed; review the diagnostic CLI adapter');
  return source.replace(anchor, `key: ${JSON.stringify(key)},`);
}

function start() {
  const expoRequire = createRequire(require.resolve('expo/package.json'));
  const cliMain = expoRequire.resolve('@expo/cli');
  const filename = path.resolve(
    path.dirname(cliMain),
    '../src/start/server/middleware/ExpoGoManifestHandlerMiddleware.js'
  );
  const source = withSessionAssetKey(readFileSync(filename, 'utf8'), 'form0-phase-' + randomUUID());
  const manifestModule = new Module(filename, module);
  manifestModule.filename = filename;
  manifestModule.paths = Module._nodeModulePaths(path.dirname(filename));
  require.cache[filename] = manifestModule;
  manifestModule._compile(source, filename);
  manifestModule.loaded = true;
  console.info(
    '[form0 device Metro]',
    JSON.stringify({ type: 'production-launch-asset-key', status: 'session-key-enabled' })
  );
  require(cliMain);
}

module.exports = { withSessionAssetKey };
if (require.main === module) start();
