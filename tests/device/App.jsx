import React, { useMemo, useRef, useState } from 'react';
import { Platform, View, Text, Pressable, Switch, ScrollView } from 'react-native';
import { FormRenderer, form0Fonts } from 'form0-react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { deviceFixture } from './record-fixtures.js';
import { profilePreparation } from './preparation-profile.js';
import { DIAGNOSTIC_BUILD, checkDiagnosticBootstrap } from './diagnostic-bootstrap.js';
import { storeStructuredRecord, getRecentStoredRecords } from './local-record-store.js';
const storage = {
  databaseName: 'form0-plan3-acceptance.db',
  tableName: 'plan3_freshness',
};
const clock = () => globalThis.performance?.now?.() ?? Date.now();
export default function App() {
  const [fontsLoaded] = useFonts(form0Fonts);
  const [kind, setKind] = useState('nested'),
    [generation, setGeneration] = useState(0),
    [seed, setSeed] = useState(null);
  const [failWrites, setFailWrites] = useState(false),
    [safe, setSafe] = useState(false);
  const [status, setStatus] = useState('Choose a walkthrough.'),
    [working, setWorking] = useState(''),
    [busy, setBusy] = useState(false);
  const controller = useRef(null),
    prepared = useRef(null),
    abort = useRef(null);
  const fixture = useMemo(() => deviceFixture(kind), [kind]);
  const engineOptions = useMemo(
    () => ({
      security: safe ? { mode: 'safe' } : undefined,
      diagnostics: { console: false },
      events: { lifecycle: true, recordKind: 'existing' },
      onEventController: (value) => {
        controller.current = value;
      },
    }),
    [safe]
  );
  const choose = (next) => {
    abort.current?.abort();
    prepared.current = null;
    setSeed(null);
    setKind(next);
    setGeneration((value) => value + 1);
    setStatus('Fresh fixture; not persisted.');
  };
  const persist = async (record, meta) => {
    if (failWrites) {
      setStatus('Simulated persistence failure. Selected values remain unsaved.');
      throw new Error('Simulated persistence failure');
    }
    await storeStructuredRecord(
      {
        id: kind,
        kind,
        record,
        freshness: meta.freshness,
        snapshot: record.raw_values
          ? record
          : {
              raw_values: meta.rawValues ?? record.raw_values,
              repeatable: meta.repeatable ?? record.repeatable,
              timestamps: meta.timestamps ?? record.timestamps,
            },
      },
      { config: storage }
    );
    if (kind === 'nested' || kind === 'confirm') {
      console.info('[form0 acceptance] Persisted record and freshness', {
        walkthrough: kind,
        record,
        freshness: meta.freshness,
      });
    }
    setStatus('Persisted record and freshness together: ' + meta.freshness.status);
  };
  const reopen = async () => {
    abort.current?.abort();
    prepared.current = null;
    const rows = await getRecentStoredRecords({ limit: 50, config: storage });
    const envelope = rows
      .map((row) => JSON.parse(row.record_json))
      .find((value) => value.kind === kind);
    if (!envelope) {
      setStatus('No saved envelope for this walkthrough.');
      return;
    }
    setSeed(envelope);
    setGeneration((value) => value + 1);
    setStatus('Reopened persisted record and companion.');
  };
  const prepare = async () => {
    const target = controller.current;
    if (!target || busy) return;
    prepared.current = null;
    const cancellation = new AbortController();
    abort.current = cancellation;
    setBusy(true);
    let last = clock(),
      maxGap = 0;
    const start = last;
    const timer = setInterval(() => {
      const now = clock();
      maxGap = Math.max(maxGap, now - last);
      last = now;
    }, 16);
    try {
      const result = await target.prepareSave({
        intent: 'submit',
        signal: cancellation.signal,
      });
      maxGap = Math.max(maxGap, clock() - last);
      if (result.eligible) prepared.current = { target, result };
      setStatus(
        JSON.stringify({
          revision: 'native-production-baseline',
          type: 'controller-preparation',
          fixture: kind,
          dev: typeof __DEV__ !== 'undefined' && __DEV__,
          hermes: Boolean(globalThis.HermesInternal),
          safe,
          status: result.status,
          eligible: result.eligible,
          elapsedMs: Math.round(clock() - start),
          maxObservedJsGapMs: Math.round(maxGap),
          issues: result.issues?.map((issue) => issue.code),
        })
      );
    } catch (error) {
      setStatus(error.message);
    } finally {
      clearInterval(timer);
      setBusy(false);
      abort.current = null;
    }
  };
  const profile = async () => {
    if (busy) return;
    const cancellation = new AbortController();
    abort.current = cancellation;
    setBusy(true);
    setStatus('Profiling the 200-row fixture; this does not edit or save the displayed record.');
    let stage = 'checking-bootstrap';
    let diagnostic = null;
    try {
      const input = deviceFixture('large200');
      diagnostic = globalThis.__form0DevicePhaseDiagnostic;
      checkDiagnosticBootstrap(diagnostic);
      stage = 'loading-bundled-evaluator';
      const instrumented = await diagnostic.load();
      stage = 'evaluating-profile';
      const result = await profilePreparation({
        schema: input.schema,
        snapshot: {
          values: input.snapshot.raw_values,
          repeatable: input.snapshot.repeatable,
        },
        security: engineOptions.security,
        signal: cancellation.signal,
        warmSamples: 3,
        instrumentedFactory: instrumented?.createRecordEvaluator,
      });
      const report = {
        type: 'preparation-profile',
        revision: DIAGNOSTIC_BUILD,
        rows: 200,
        dev: typeof __DEV__ !== 'undefined' && __DEV__,
        hermes: Boolean(globalThis.HermesInternal),
        androidVersion: Platform.Version,
        nativeVersion: Platform.constants?.reactNativeVersion,
        safe,
        diagnosticSourceHash: diagnostic?.sourceHash ?? null,
        diagnosticLoading: diagnostic?.loading ?? null,
        bootstrapRevision: diagnostic?.bootstrapRevision ?? null,
        ...result,
      };
      console.info('[form0 acceptance] Preparation profile', JSON.stringify(report));
      setStatus(JSON.stringify(report));
    } catch (error) {
      setStatus(
        JSON.stringify({
          type: 'preparation-profile-error',
          revision: DIAGNOSTIC_BUILD,
          stage,
          dev: typeof __DEV__ !== 'undefined' && __DEV__,
          hermes: Boolean(globalThis.HermesInternal),
          diagnosticLoading: diagnostic?.loading ?? null,
          bootstrapRevision: diagnostic?.bootstrapRevision ?? null,
          code: error.code ?? null,
          message: error.message,
          frames: (error.stack || '')
            .split('\n')
            .slice(1, 7)
            .map((line) => line.replace(/https?:\/\/\S+/g, '<bundle>')),
        })
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };
  const persistPrepared = async () => {
    const selected = prepared.current;
    if (!selected || busy) return;
    setBusy(true);
    try {
      await persist(selected.result.payload, selected.result.meta);
      const ack = selected.target.acknowledgeSave({
        preparationId: selected.result.preparationId,
      });
      setStatus('Acknowledgement: ' + ack.status);
      prepared.current = null;
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };
  const button = (text, action) => (
    <Pressable
      accessibilityRole="button"
      onPress={action}
      style={{ padding: 8, borderWidth: 1, borderColor: '#999', margin: 3 }}
    >
      <Text>{text}</Text>
    </Pressable>
  );
  const nativeVersion = Platform.constants?.reactNativeVersion;
  if (!fontsLoaded) return <Text>Loading test fonts…</Text>;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={{ padding: 8 }}>
          <Text>
            Plan 3 · {Platform.OS} {Platform.Version} · RN {JSON.stringify(nativeVersion)} · Hermes{' '}
            {String(Boolean(globalThis.HermesInternal))}
          </Text>
          <Text>Record device model and Expo client version in the acceptance report.</Text>
          <Text>JS development mode: {String(typeof __DEV__ !== 'undefined' && __DEV__)}</Text>
          <Text>
            Harness build: {DIAGNOSTIC_BUILD} · Bootstrap:{' '}
            {globalThis.__form0DevicePhaseDiagnostic?.bootstrapRevision ?? 'old/missing'}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {button('Nested editing', () => choose('nested'))}
            {button('Confirmation / persistence', () => choose('confirm'))}
            {button('Large 200', () => choose('large200'))}
            {button('Large 2,000', () => choose('large2000'))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text>Simulate persistence failure</Text>
            <Switch value={failWrites} onValueChange={setFailWrites} />
            <Text>SAFE</Text>
            <Switch
              value={safe}
              onValueChange={(value) => {
                setSafe(value);
                setGeneration((n) => n + 1);
              }}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {button('Reopen saved', reopen)}
            {button('Programmatic prepare', prepare)}
            {button('Profile phases v3 (200)', profile)}
            {button('Cancel preparation', () => abort.current?.abort())}
            {button('Persist prepared', persistPrepared)}
          </View>
          <ScrollView style={{ maxHeight: 180 }}>
            <Text selectable accessibilityLiveRegion="polite">
              {status}
            </Text>
          </ScrollView>
          <Text>{busy ? 'Preparing…' : ''}</Text>
          <Text>Working values: {working}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <FormRenderer
            key={generation}
            colorMode="light"
            schema={fixture.schema}
            initialSnapshot={seed?.snapshot || fixture.snapshot}
            initialFreshness={seed?.freshness}
            submissionOptions={{ allowRetain: true }}
            onSubmit={persist}
            onSave={persist}
            engineOptions={engineOptions}
            onSnapshotChange={(snapshot, meta) =>
              setWorking(
                JSON.stringify({
                  dirty: meta.dirty,
                  totals: Object.fromEntries(
                    Object.entries(snapshot.raw_values)
                      .filter(
                        ([key, value]) =>
                          typeof value === 'number' &&
                          (key.includes('total') || key === 'grand' || key.startsWith('root_c'))
                      )
                      .slice(0, 10)
                  ),
                  ...(kind === 'confirm'
                    ? {
                        acceptedChildTotals: (snapshot.repeatable.lines || []).map(
                          (row) => row.values.total
                        ),
                      }
                    : {}),
                })
              )
            }
          />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
