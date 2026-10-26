import { cp, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Only an ignored device diagnostic copy is instrumented. Shipped core remains untouched.
export function instrumentRecordEvaluator(source) {
  const replace = (before, after) => {
    if (source.indexOf(before) < 0 || source.indexOf(before) !== source.lastIndexOf(before))
      throw new Error('Diagnostic source anchor changed: ' + before.slice(0, 90));
    source = source.replace(before, after);
  };
  replace(
    '  onDiagnostics = null,\n}) {',
    `  onDiagnostics = null,
  __phaseObserver,
}) {
  const __phase = (name) => __phaseObserver.start(name);`
  );
  replace(
    '    const snapshot = scoped ? input : copyRecordData(input);',
    `    const __endCapture = __phase('inputCapture');
    const snapshot = scoped ? input : copyRecordData(input);
    __endCapture();
    const __endSetup = __phase('scopeAndDependencySetup');`
  );
  replace(
    '    for (const node of ordered) {\n      execute(node);',
    `    __endSetup();
    const __endCalculations = __phase('calculations');
    for (const node of ordered) {
      execute(node);`
  );
  replace(
    '    for (const scope of scopes) {\n      if (scoped && scope !== selectedScope) continue;\n      const values = readable(scope);',
    `    __endCalculations();
    const __endConditions = __phase('conditionsAndIntrinsicFields');
    for (const scope of scopes) {
      if (scoped && scope !== selectedScope) continue;
      const values = readable(scope);`
  );
  replace(
    '    const changes = [];',
    `    __endConditions();
    const __endChanges = __phase('changeReport');
    const changes = [];`
  );
  replace(
    '    if (scoped) {\n      // A scoped caller',
    `    __endChanges();
    if (scoped) {
      // A scoped caller`
  );
  replace(
    '    if (options.managedEvents === true) {',
    `    const __endManaged = __phase('managedValidation');
    if (options.managedEvents === true) {`
  );
  replace(
    '        const values = Object.assign(',
    `        const __endContext = __phase('managedContextAndRegistration');
        const values = Object.assign(`
  );
  replace(
    '        const dispatch = createManagedEventDispatcher(',
    `        __endContext();
        const __endDispatch = __phase('managedDispatch');
        const dispatch = createManagedEventDispatcher(`
  );
  replace(
    '        executionIssues.push(...detail.issues);',
    `        executionIssues.push(...detail.issues);
        __endDispatch();`
  );
  replace(
    '    const validationSummary = validateSubmissionWithContext(result.snapshot, context, custom);',
    `    __endManaged();
    const __endSummary = __phase('submissionSummary');
    const validationSummary = validateSubmissionWithContext(result.snapshot, context, custom);
    __endSummary();`
  );
  replace(
    '      const result = await copyRecordDataCooperatively(\n        {\n          ...prepared,',
    `      const __endDelivery = __phase('publicResultCopyAndFreshness');
      const result = await copyRecordDataCooperatively(
        {
          ...prepared,`
  );
  replace(
    '      return result;\n    } catch (error) {\n      return failure(error);\n    }\n  }\n  return { evaluate, evaluateScope, prepareSubmission };',
    `      __endDelivery();
      return result;
    } catch (error) {
      return failure(error);
    }
  }
  return { evaluate, evaluateScope, prepareSubmission };`
  );
  return '// DIAGNOSTIC ONLY: phase boundaries; never a publishable candidate.\n' + source;
}

export function createPhaseDiagnosticEntry(sourceHash) {
  return `// Device harness only. Bundle the module; initialize it only when Profile is pressed.
globalThis.__form0DevicePhaseDiagnostic = {
  sourceHash: ${JSON.stringify(sourceHash)},
  loading: 'bundled-require',
  load: () => require('./diagnostic-core-20261026/src/engine/record-evaluator.js'),
};
`;
}

export async function prepareDevicePhaseProfile(target) {
  const sourceRoot = path.join(target, 'node_modules/form0-core/src');
  const relative = 'engine/record-evaluator.js';
  const source = await readFile(path.join(sourceRoot, relative), 'utf8');
  const instrumented = instrumentRecordEvaluator(source);
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const output = path.join(target, 'diagnostic-core-20261026');
  await mkdir(output, { recursive: true });
  await cp(sourceRoot, path.join(output, 'src'), {
    recursive: true,
    filter: async (entry) => {
      if (path.basename(entry).startsWith('.')) return false;
      const info = await lstat(entry);
      return info.isDirectory() || (info.isFile() && entry.endsWith('.js'));
    },
  });
  await writeFile(path.join(output, 'src', relative), instrumented);
  await writeFile(
    path.join(output, 'DIAGNOSTIC_ONLY.txt'),
    'Phase-instrumented source copy. Not a package candidate. Source SHA256: ' + sourceHash + '\n'
  );
  await writeFile(path.join(target, 'phase-diagnostic.js'), createPhaseDiagnosticEntry(sourceHash));
  const entryPath = path.join(target, 'index.js');
  const entry = await readFile(entryPath, 'utf8');
  if (!entry.includes("import './phase-diagnostic.js';"))
    await writeFile(entryPath, "import './phase-diagnostic.js';\n" + entry);
  return { sourceHash, instrumentedHash: createHash('sha256').update(instrumented).digest('hex') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const target = path.resolve(
    process.argv[2] || path.join(workspace, '.local-test-harnesses/form0-plan3-20261022/device')
  );
  console.log(JSON.stringify(await prepareDevicePhaseProfile(target)));
}
