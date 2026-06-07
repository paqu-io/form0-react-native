import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const fieldRegistrySource = readFileSync(
  new URL('../src/field-registry.js', import.meta.url),
  'utf8',
);
const fieldRegistryContextSource = readFileSync(
  new URL('../src/field-registry-context.jsx', import.meta.url),
  'utf8',
);
const formRendererSource = readFileSync(
  new URL('../src/form-renderer.jsx', import.meta.url),
  'utf8',
);

assert.match(
  fieldRegistrySource,
  /Object\.entries\(renderers\)\.forEach/,
  'field-registry.js should merge custom renderers into an isolated registry instance',
);

assert.match(
  fieldRegistryContextSource,
  /renderers,/,
  'FieldRegistryProvider should accept the renderers prop',
);

assert.match(
  formRendererSource,
  /renderers,/,
  'FormRenderer should plumb renderers through to the registry provider',
);

assert.match(
  formRendererSource,
  /const \[repeatableStack, setRepeatableStack\] = useState\(\[\]\);/,
  'FormRenderer should keep repeatable drilldown navigation state',
);

assert.match(
  formRendererSource,
  /const handleRepeatableSave = useCallback/,
  'FormRenderer should expose a repeatable save handler',
);

assert.match(
  formRendererSource,
  /screen\.controller\.setInstances\(repeatableKey, next, parentPath\);/,
  'Editing an existing repeatable entry should replace it in place',
);

assert.match(
  formRendererSource,
  /screen\.controller\.setInstances\(repeatableKey, \[\.\.\.existing, payload\], parentPath\);/,
  'Creating a repeatable entry should append it to the current collection',
);

assert.match(
  formRendererSource,
  /label: 'Cancel'/,
  'Repeatable drilldown headers should keep a cancel affordance',
);

assert.match(
  formRendererSource,
  /label: 'Save'/,
  'Repeatable drilldown headers should keep a save affordance',
);

console.log('form0-react-native source smoke tests passed');
