import { createFormEngine } from 'form0-core';
import {
  createBindingDiagnosticScope,
  createDiagnosticEngine,
  buildDiagnosticInstancePath,
} from '../../src/utils/engine-diagnostics.js';

export const field = (type, name, extra = {}) => ({
  type,
  key: name,
  data_name: name,
  label: name,
  display: type === 'CalculatedField' ? { style: 'text' } : 'default',
  description: null,
  description_mode: null,
  required: false,
  visible: true,
  visible_conditions: null,
  read_only: type === 'CalculatedField',
  supporting_image: false,
  supporting_image_path: null,
  supporting_image_display: null,
  ...(type === 'CalculatedField'
    ? { calculate: '1' }
    : {
        default_value: null,
        required_conditions: null,
        read_only_conditions: null,
      }),
  ...(type === 'NumericField' ? { min: null, max: null, format: 'integer' } : {}),
  ...(type === 'TextField' ? { pattern: null, pattern_description: null } : {}),
  ...extra,
  ...(type === 'CalculatedField' && /\b(return|throw|const)\b/.test(extra.calculate || '')
    ? { calculate: extra.calculate.replaceAll('; ', ';\n') + '\n' }
    : {}),
});
export const repeatable = (name, elements) => ({
  type: 'RepeatableSection',
  key: name,
  data_name: name,
  label: name,
  display: 'drilldown',
  description: null,
  description_mode: null,
  visible: true,
  visible_conditions: null,
  location_enabled: false,
  location_required: false,
  elements,
});
export const schema = {
  form: {
    name: 'Diagnostics',
    elements: [
      field('NumericField', 'input', { default_value: 0 }),
      field('CalculatedField', 'result', {
        calculate:
          "if ($input == null || $input === 0) { throw new Error('input must not be zero'); } return 12 / $input;",
      }),
    ],
  },
};
export const nestedSchema = {
  form: {
    name: 'Nested diagnostics',
    elements: [
      ...schema.form.elements,
      repeatable('rows', [
        field('NumericField', 'amount', { default_value: 4 }),
        field('CalculatedField', 'row_total', {
          calculate:
            "if ($amount === 0) { throw new Error('row amount is zero'); } return $amount * 2;",
        }),
        repeatable('children', [
          field('NumericField', 'quantity', { default_value: 4 }),
          field('CalculatedField', 'child_total', {
            calculate:
              "if ($quantity === 0) { throw new Error('child quantity is zero'); } return $quantity * 3;",
          }),
        ]),
      ]),
    ],
  },
};

export function diagnosticConformance(test, assert) {
  test('real evaluations replace snapshots, preserve severity and repeat/recovery/recurrence', () => {
    const reports = [];
    const output = [];
    const scope = createBindingDiagnosticScope({
      fieldNames: ['input', 'result'],
      getOptions: () => ({
        onDiagnostics: (snapshot, meta) => reports.push({ snapshot, meta }),
      }),
      emit: (item) => output.push(item),
    });
    const engine = createDiagnosticEngine({
      schema,
      onDiagnostics: (snapshot) => scope.accept(snapshot),
    });
    engine.eval();
    engine.eval();
    assert.equal(reports.length, 2);
    assert.equal(output.filter((e) => e.kind === 'diagnostic').length, 1);
    assert.equal(reports[0].snapshot[0].severity, 'error');
    assert.equal(reports[0].snapshot[0].code, 'runtime_exception');
    engine.getState().values.input = 4;
    engine.eval();
    assert.deepEqual(reports[2].snapshot, []);
    assert.equal(output.filter((e) => e.kind === 'resolved').length, 1);
    engine.getState().values.input = 0;
    engine.eval();
    assert.equal(output.filter((e) => e.kind === 'diagnostic').length, 2);
    assert.deepEqual(
      reports.map((r) => r.meta.evaluationId),
      [1, 2, 3, 4]
    );
    assert.deepEqual(engine.getState().errors, {});
    scope.end();
    scope.end();
    assert.equal(reports.length, 5);
    assert.equal(reports[4].meta.kind, 'scope-ended');
    assert.deepEqual(reports[4].snapshot, []);
    assert.equal(output.filter((e) => e.kind === 'scope-ended').length, 1);
    assert.equal(output.filter((e) => e.kind === 'resolved').length, 1);
    assert.equal(scope.accept(engine.getDiagnostics()), false);
  });
  test('changed nonempty snapshots report the new finding and resolve the previous one', () => {
    const output = [];
    const reports = [];
    const scope = createBindingDiagnosticScope({
      getOptions: () => ({ onDiagnostics: (d) => reports.push(d) }),
      emit: (e) => output.push(e),
    });
    const fixture = {
      form: {
        name: 'Changed',
        elements: [
          field('NumericField', 'input'),
          field('CalculatedField', 'result', {
            calculate:
              "if ($input === 0) { throw new Error('zero'); } if ($input === 1) { throw new Error('one'); } return 12 / $input;",
          }),
        ],
      },
    };
    const engine = createDiagnosticEngine({
      schema: fixture,
      initialValues: { input: 0 },
      onDiagnostics: (d) => scope.accept(d),
    });
    engine.eval();
    engine.getState().values.input = 1;
    engine.eval();
    assert.equal(reports[0][0].message, 'zero');
    assert.equal(reports[1][0].message, 'one');
    assert.equal(scope.getDiagnostics()[0].message, 'one');
    assert.equal(output.filter((e) => e.kind === 'diagnostic').length, 2);
    assert.equal(output.filter((e) => e.kind === 'resolved').length, 1);
  });
  test('suppression retains collection, refreshed callbacks and re-enabled reporting', () => {
    let options = { diagnostics: { console: false }, onDiagnostics: () => {} };
    const emitted = [];
    const seen = [];
    const scope = createBindingDiagnosticScope({
      getOptions: () => options,
      emit: (e) => emitted.push(e),
    });
    const engine = createDiagnosticEngine({
      schema,
      onDiagnostics: (d) => scope.accept(d),
    });
    engine.eval();
    assert.equal(scope.getDiagnostics().length, 1);
    assert.equal(emitted.length, 0);
    options = { onDiagnostics: (d, m) => seen.push({ d, m }) };
    scope.setConsole(true);
    engine.eval();
    assert.equal(seen.length, 1);
    assert.equal(emitted.filter((e) => e.kind === 'diagnostic').length, 1);
    options = {
      diagnostics: { console: false },
      onDiagnostics: (d, m) => seen.push({ d, m }),
    };
    scope.end();
    assert.equal(seen[1].m.kind, 'scope-ended');
  });
  test('defensive copies, complete row attribution and stale sequence rejection', () => {
    const path = buildDiagnosticInstancePath({
      parentInstancePath: [
        {
          repeatableKey: 'rows',
          instanceId: 'row-b',
          index: 1,
          identity: 'id',
        },
      ],
      repeatableKey: 'children',
      instance: { id: 'child-b' },
      index: 0,
    });
    const seen = [];
    const scope = createBindingDiagnosticScope({
      fieldNames: ['child_total'],
      instancePath: path,
      getOptions: () => ({
        diagnostics: { console: false },
        onDiagnostics: (d, m) => {
          seen.push({ d, m });
          d[0].message = 'changed';
          m.instancePath[0].instanceId = 'changed';
        },
      }),
    });
    const engine = createFormEngine({
      schema: nestedSchema,
      initialValues: { input: 0, amount: 0, quantity: 0 },
      diagnostics: { console: false },
    });
    engine.eval();
    const raw = engine.getDiagnostics();
    assert.equal(scope.accept(raw, 2), true);
    assert.equal(scope.accept([], 1), false);
    assert.equal(scope.accept([], 2), false);
    assert.equal(scope.getDiagnostics().length, 1);
    assert.equal(scope.getDiagnostics()[0].fieldName, 'child_total');
    assert.equal(scope.getDiagnostics()[0].context.instancePath[0].instanceId, 'row-b');
    assert.notEqual(scope.getDiagnostics()[0].message, 'changed');
    assert.notEqual(raw[0].message, 'changed');
    const copy = scope.getDiagnostics();
    copy[0].code = 'wrong';
    assert.equal(scope.getDiagnostics()[0].code, 'runtime_exception');
    const fallback = buildDiagnosticInstancePath({
      repeatableKey: 'rows',
      instance: {},
      index: 2,
    });
    assert.equal(fallback[0].identity, 'position');
    assert.equal(fallback[0].instanceId, null);
    assert.equal(fallback[0].index, 2);
    const complete = buildDiagnosticInstancePath({
      parentInstancePath: path.slice(0, 1),
      parentPath: [{ key: 'rows', id: 'row-b' }],
      repeatableKey: 'children',
      instance: { record_id: 'child-b' },
    });
    assert.equal(complete.length, 2);
  });
  test('warning severity, explicit return and intermediate-pass errors retain core semantics', () => {
    const warningSchema = {
      form: {
        name: 'Warning',
        elements: [
          field('TextField', 'selector', { default_value: 'source' }),
          field('CalculatedField', 'target', {
            calculate: 'return EVAL("$" + $selector);',
          }),
          field('NumericField', 'source', { default_value: 23 }),
        ],
      },
    };
    const engine = createDiagnosticEngine({ schema: warningSchema });
    engine.eval();
    assert.ok(
      engine
        .getDiagnostics()
        .some((d) => d.severity === 'warning' && d.code === 'dynamic_dependencies')
    );
    const missing = createDiagnosticEngine({
      schema: {
        form: {
          name: 'Missing',
          elements: [
            field('CalculatedField', 'result', { calculate: 'const value = 1;\nvalue + 1;' }),
          ],
        },
      },
    });
    missing.eval();
    assert.ok(
      missing.getDiagnostics().some((d) => d.code === 'missing_result' && d.severity === 'warning')
    );
    const returning = createDiagnosticEngine({
      schema: {
        form: {
          name: 'Return',
          elements: [
            field('CalculatedField', 'result', {
              calculate: "const value = 'a'; return value;",
            }),
          ],
        },
      },
    });
    returning.eval();
    assert.equal(returning.getState().values.result, 'a');
    assert.deepEqual(returning.getDiagnostics(), []);
    const intermediate = createDiagnosticEngine({
      schema: {
        form: {
          name: 'Intermediate',
          elements: [
            field('CalculatedField', 'target', {
              calculate:
                "const value = EVAL('$' + $selector); if (value == null) { throw new Error('not ready'); } return value;",
            }),
            field('CalculatedField', 'source', { calculate: '23' }),
            field('TextField', 'selector', { default_value: 'source' }),
          ],
        },
      },
    });
    intermediate.eval();
    assert.equal(intermediate.getState().values.target, 23);
    assert.ok(
      intermediate
        .getDiagnostics()
        .some((d) => d.code === 'runtime_exception' && d.severity === 'error')
    );
  });
  test('throwing/rejected observers and console adapters cannot change evaluation', async () => {
    for (const onDiagnostics of [
      () => {
        throw Error('observer');
      },
      () => Promise.reject(Error('observer')),
    ]) {
      const scope = createBindingDiagnosticScope({
        getOptions: () => ({ onDiagnostics }),
        emit: () => {
          throw Error('console');
        },
      });
      const engine = createDiagnosticEngine({
        schema,
        onDiagnostics: (d) => scope.accept(d),
      });
      engine.eval();
      await Promise.resolve();
      await Promise.resolve();
      assert.equal(engine.getState().values.result, null);
      assert.equal(engine.getDiagnostics().length, 1);
    }
  });
  test('legacy initial warnings remain observable and evaluated state/counts match plain core', () => {
    let before = 0,
      after = 0;
    const fixture = {
      form: {
        name: 'Counts',
        elements: [field('CalculatedField', 'result', { calculate: 'return count();' })],
      },
    };
    const plain = createFormEngine({
      schema: fixture,
      helpers: { count: () => ++before },
      diagnostics: { console: false },
    });
    const observed = createDiagnosticEngine({
      schema: fixture,
      helpers: { count: () => ++after },
    });
    plain.eval();
    observed.eval();
    assert.deepEqual(plain.getState(), observed.getState());
    assert.equal(before, after);
    assert.ok(before > 0);
    const warnings = [];
    const engine = createDiagnosticEngine({
      schema: {
        form: {
          name: 'Warning',
          elements: [
            field('CalculatedField', 'result', {
              calculate: 'return $missing; ',
            }),
          ],
        },
      },
      onWarning: (w) => warnings.push(w),
    });
    engine.eval();
    assert.ok(warnings.length);
    assert.equal(warnings[0].reason, 'not_found');
  });
}
