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
const fieldComponentsSource = readFileSync(
  new URL('../src/field-components/index.js', import.meta.url),
  'utf8',
);
const signatureFieldSource = readFileSync(
  new URL('../src/field-components/signature-field.js', import.meta.url),
  'utf8',
);
const formRendererSource = readFileSync(
  new URL('../src/form-renderer.jsx', import.meta.url),
  'utf8',
);
const formHeaderSource = readFileSync(
  new URL('../src/form-header.jsx', import.meta.url),
  'utf8',
);
const repeatableInstanceSource = readFileSync(
  new URL('../src/use-repeatable-instance.js', import.meta.url),
  'utf8',
);
const packageTypesSource = readFileSync(
  new URL('../src/index.d.ts', import.meta.url),
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

  assert.match(
    fieldRegistrySource,
    /warnAboutPlaceholderBackedFieldTypes/,
    'Field registry should warn when placeholder-backed defaults are still active',
  );

  assert.match(
    fieldComponentsSource,
    /SignatureField:\s*SignatureFieldComponent/,
    'SignatureField should ship with a built-in native renderer',
  );

  assert.match(
    signatureFieldSource,
    /toDataURL\(/,
    'Native SignatureField should export the captured signature through react-native-svg',
  );

  assert.match(
    signatureFieldSource,
    /mime_type:\s*'image\/png'/,
    'Native SignatureField should persist signatures as PNG for parity with web',
  );

  assert.match(
    signatureFieldSource,
    /buildSignatureExportSpec/,
    'Native SignatureField should crop the exported signature to the drawn bounds',
  );

  assert.match(
    signatureFieldSource,
    /<FormHeader/,
    'Native SignatureField should reuse the safe-area-aware form header inside the signing modal',
  );
});

test('form renderer exposes parity-facing snapshot and engine APIs', () => {
  assert.match(
    formRendererSource,
    /initialSnapshot,/,
    'FormRenderer should accept initialSnapshot',
  );

  assert.match(
    formRendererSource,
    /onSnapshotChange,/,
    'FormRenderer should accept onSnapshotChange',
  );

  assert.match(
    formRendererSource,
    /engineOptions,/,
    'FormRenderer should accept engineOptions',
  );

  assert.match(
    formRendererSource,
    /forceShowNavigationPanel = false/,
    'FormRenderer should accept the web-aligned forceShowNavigationPanel prop',
  );

  assert.match(
    formRendererSource,
    /useFormEngine\(schema, appliedRendererInitialValues, overrideValues, effectiveEngineOptions\)/,
    'Root engine should receive the applied seed values and engine options',
  );

  assert.match(
    formRendererSource,
    /snapshotSeedMatchesLiveState/,
    'FormRenderer should ignore echoed snapshot seeds that match the live state',
  );

  assert.match(
    formRendererSource,
    /triggerEvent\('load-record'\);/,
    'Root form should trigger load-record when the engine becomes ready',
  );

  assert.match(
    formRendererSource,
    /triggerEvent\('edit-record'\);/,
    'Root form should trigger edit-record when entering edit mode',
  );

  assert.match(
    formRendererSource,
    /kind: 'seed'/,
    'Snapshot callbacks should emit a seed phase',
  );

  assert.match(
    formRendererSource,
    /kind: 'change'/,
    'Snapshot callbacks should emit a change phase after user edits',
  );

  assert.match(
    formRendererSource,
    /function FormNavigationSheet\(/,
    'FormRenderer should own a native navigation and validation sheet',
  );

  assert.match(
    formRendererSource,
    /if \(!Array\.isArray\(pathA\) \|\| pathA\.length === 0\)/,
    'Native drilldown path prefix checks should ignore empty candidate paths for parity with web',
  );

  assert.match(
    formRendererSource,
    /alignItems:\s*'stretch'/,
    'Native form scroll containers should stretch drilldown content to the full available width',
  );

  assert.match(
    formRendererSource,
    /width:\s*'100%'/,
    'Native drilldown section cards should explicitly occupy the full available width',
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
    /screen\.controller\.updateInstance\(/,
    'Editing an existing repeatable entry should use the controller update contract',
  );

  assert.match(
    formRendererSource,
    /screen\.controller\.addInstance\(repeatableKey, \{/,
    'Creating a repeatable entry should use the controller add contract',
  );

  assert.match(
    formRendererSource,
    /const initialInstance = useMemo\(/,
    'Repeatable editors should consume a frozen initial instance from the screen config',
  );

  assert.match(
    formRendererSource,
    /const baseValues = useMemo\(\(\) => cloneDeep\(screen\.parentValues \|\| \{\}\), \[screen\.screenId\]\);/,
    'Repeatable editors should consume frozen parent values from the screen config',
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
    formHeaderSource,
    /onTitlePress/,
    'FormHeader should accept an optional title press handler',
  );

  assert.match(
    formHeaderSource,
    /titleAccessibilityHint = 'Open form navigation'/,
    'FormHeader should expose an accessibility hint for title-triggered navigation',
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
    /function RepeatableRemoveDialog\(/,
    'Repeatable lists should own an internal remove confirmation dialog component',
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
    /navigateToRootValidationIssue\(getFirstValidationIssue\(validationSummary\)\);/,
    'Root form should navigate to the first invalid field on submit failure',
  );

  assert.match(
    formRendererSource,
    /const isWithinActiveFieldBranch =/,
    'Root drilldown rendering should only keep field content that belongs to the active branch',
  );

  assert.match(
    formRendererSource,
    /const repeatableStateRef = useRef\(appliedRepeatableSeed\);/,
    'Root repeatable controller should read from a stable repeatable state ref',
  );

  assert.match(
    formRendererSource,
    /repeatableStateRef\.current = next;/,
    'Root repeatable controller should update the repeatable ref synchronously when nested lists mutate',
  );

  assert.match(
    formRendererSource,
    /pendingRepeatableRemoval\.controller\.removeInstance\(/,
    'Repeatable list removal should route through the controller remove contract',
  );

  assert.match(
    formRendererSource,
    /const valuesRef = useRef\(values\);/,
    'Root repeatable controller should read live values through a ref',
  );

  assert.match(
    repeatableInstanceSource,
    /const initialSeedSignature = useMemo\(/,
    'Repeatable instance engine should compare the full seed by content to avoid render loops',
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

  assert.match(
    formRendererSource,
    /screen\.engineOptions\?\.onOperations/,
    'Repeatable editors should reuse engineOptions while wrapping alert operations locally',
  );
});

test('root submit is validation-gated and returns structured payload metadata', () => {
  assert.match(
    formRendererSource,
    /const rootValidationSummary = useMemo\(/,
    'FormRenderer should compute a root validation summary',
  );

  assert.match(
    formRendererSource,
    /if \(validationSummary\?\.hasErrors \|\| !onSubmit\) \{/,
    'Root submit should stop when validation fails',
  );

  assert.match(
    formRendererSource,
    /const submission = buildStructuredSubmission\(/,
    'Root submit should build a structured submission payload',
  );

  assert.match(
    formRendererSource,
    /onSubmit\(submission\.structuredRecord, \{/,
    'Root submit should pass the structured record as the first argument',
  );

  assert.match(
    formRendererSource,
    /rawValues: submission\.rawValues,/,
    'Root submit metadata should include raw values',
  );

  assert.match(
    formRendererSource,
    /timestamps: submission\.timestamps,/,
    'Root submit metadata should include timestamps',
  );
});

test('package types document snapshot and engine option contracts', () => {
  assert.match(
    packageTypesSource,
    /export type FormRendererSnapshot = \{/,
    'Package types should export the FormRendererSnapshot contract',
  );

  assert.match(
    packageTypesSource,
    /export type FormRendererEngineOptions = \{/,
    'Package types should export the engine options contract',
  );

  assert.match(
    packageTypesSource,
    /initialSnapshot\?: FormRendererSnapshot;/,
    'FormRenderer props should expose initialSnapshot in the package types',
  );

  assert.match(
    packageTypesSource,
    /forceShowNavigationPanel\?: boolean;/,
    'FormRenderer props should expose forceShowNavigationPanel in the package types',
  );
});
