import test from 'node:test';
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
const repeatableInstanceSource = readFileSync(
  new URL('../src/use-repeatable-instance.js', import.meta.url),
  'utf8',
);

test('field registry still merges renderer overrides', () => {
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
});

test('repeatable screens keep a mounted stack and save through the controller contract', () => {
  assert.match(
    formRendererSource,
    /const \[repeatableStack, setRepeatableStack\] = useState\(\[\]\);/,
    'FormRenderer should keep repeatable drilldown navigation state',
  );

  assert.match(
    formRendererSource,
    /repeatableStack\.map\(\(screen, index\) =>/,
    'Repeatable screens should stay mounted in a stack instead of rendering only the top screen',
  );

  assert.match(
    formRendererSource,
    /display: isActive \? 'flex' : 'none'/,
    'Hidden repeatable screens should stay mounted and only toggle visibility',
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
});

test('repeatable list and editor use shared header-driven chrome', () => {
  assert.match(
    formRendererSource,
    /<FormHeader\s+formName=\{label\}/,
    'Repeatable list should use FormHeader',
  );

  assert.match(
    formRendererSource,
    /<FormHeader\s+formName=\{headerTitle\}/,
    'Repeatable editor should use FormHeader',
  );

  assert.match(
    formRendererSource,
    /const addLabel = `\+ \$\{getRepeatableAddLabel\(screen\.field\)\}`;/,
    'Repeatable list should derive the add action label from schema metadata',
  );

  assert.match(
    formRendererSource,
    /icon: null/,
    'Repeatable add action should render as text-only so the label stays "+ Add"',
  );

  assert.match(
    formRendererSource,
    /const description = screen\.field\?\.description \|\| null;/,
    'Repeatable list should render the schema description',
  );

  assert.match(
    formRendererSource,
    />View<\/Text>/,
    'Repeatable row action label should be View',
  );

  assert.doesNotMatch(
    formRendererSource,
    /Add entry|Save entry/,
    'Legacy bottom repeatable CTAs should be removed',
  );
});

test('repeatable editor owns a mobile discard modal and validation navigation hooks', () => {
  assert.match(
    formRendererSource,
    /function RepeatableDiscardDialog\(/,
    'Repeatable editor should own an internal discard dialog component',
  );

  assert.match(
    formRendererSource,
    /<Modal\s+visible=\{visible\}/,
    'Discard confirmation should use a React Native Modal instead of Alert',
  );

  assert.match(
    formRendererSource,
    /Keep editing/,
    'Discard confirmation should keep the mobile-friendly keep editing affordance',
  );

  assert.match(
    formRendererSource,
    /const validationFields = useMemo\(/,
    'Repeatable editor should build a validation field list',
  );

  assert.match(
    formRendererSource,
    /navigateToValidationIssue\(getFirstValidationIssue\(validationSummary\)\);/,
    'Repeatable editor should navigate to the first invalid field on save failure',
  );

  assert.match(
    formRendererSource,
    /const repeatableStateRef = useRef\(\{\}\);/,
    'Root repeatable controller should read from a stable repeatable state ref',
  );

  assert.match(
    formRendererSource,
    /repeatableStateRef\.current = next;/,
    'Root repeatable controller should update the repeatable ref synchronously when nested lists mutate',
  );

  assert.match(
    formRendererSource,
    /const valuesRef = useRef\(values\);/,
    'Root repeatable controller should read live values through a ref',
  );

  assert.match(
    repeatableInstanceSource,
    /const baseValuesSignature = useMemo\(\(\) => JSON\.stringify\(baseValues \|\| \{\}\), \[baseValues\]\);/,
    'Repeatable instance engine should compare base values by content to avoid render loops',
  );

  assert.match(
    repeatableInstanceSource,
    /repeatableStateRef\.current = next;/,
    'Scoped repeatable controllers should update their ref synchronously so child lists reflect saved entries immediately',
  );

  assert.match(
    formRendererSource,
    /parentPath: nestedRepeatableParentPath,/,
    'Nested repeatables inside a repeatable editor should use the local controller root instead of an absolute path',
  );
});
