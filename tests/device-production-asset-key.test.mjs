import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { withSessionAssetKey } from './device/production-cli.cjs';

test('diagnostic launch key is set before manifest serialization and signing', () => {
  const source = `const manifest = { launchAsset: { key: 'bundle', url: '/current.bundle' } };
    const serialized = JSON.stringify(manifest);
    sign(serialized);`;
  const signed = [];
  vm.runInNewContext(withSessionAssetKey(source, 'form0-phase-fixture'), {
    sign: (value) => signed.push(JSON.parse(value)),
  });
  assert.deepEqual(signed, [
    { launchAsset: { key: 'form0-phase-fixture', url: '/current.bundle' } },
  ]);
});

test('SDK source drift and unsafe diagnostic asset keys fail explicitly', () => {
  for (const source of ['', "key: 'bundle', key: 'bundle',"])
    assert.throws(() => withSessionAssetKey(source, 'form0-phase-fixture'), /anchor changed/);
  for (const key of ['bundle', 'form0-phase-../old', "form0-phase-';"])
    assert.throws(() => withSessionAssetKey("key: 'bundle',", key), /Invalid diagnostic asset key/);
});
