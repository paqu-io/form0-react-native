import { createRecordEvaluator } from 'form0-core';
import { createRecordScheduler } from '../../src/utils/record-scheduling.js';

const clock = () => globalThis.performance?.now?.() ?? Date.now();
const timerYield = () => new Promise((resolve) => setTimeout(resolve, 0));
const round = (value) => Math.round(value * 10) / 10;
function checkCancellation(signal) {
  if (signal?.aborted) throw new Error('Preparation profile cancelled.');
}

/** Diagnostic harness only: report timings, never record values or executable proposals. */
export async function profilePreparation({
  schema,
  snapshot,
  security,
  signal,
  warmSamples = 1,
  instrumentedFactory,
}) {
  if (!Number.isInteger(warmSamples) || warmSamples < 1 || warmSamples > 3)
    throw new Error('Profile warmSamples must be between 1 and 3.');
  const scheduler = createRecordScheduler({ signal });
  const timerSamples = [];
  for (let index = 0; index < 20; index++) {
    checkCancellation(signal);
    const start = clock();
    await timerYield();
    timerSamples.push(clock() - start);
  }
  const samples = [];
  for (const managedEvents of [false, true]) {
    checkCancellation(signal);
    const factoryStart = clock();
    const evaluator = createRecordEvaluator({
      schema,
      security,
      diagnostics: { console: false },
    });
    const factoryMs = clock() - factoryStart;
    for (let index = 0; index <= warmSamples; index++) {
      const temperature = index === 0 ? 'cold' : 'warm';
      let yields = 0,
        yieldWaitMs = 0,
        maxWorkSliceMs = 0,
        last = clock();
      const start = last;
      const result = await evaluator.prepareSubmission(snapshot, {
        managedEvents,
        signal,
        yieldToHost: async () => {
          const before = clock();
          maxWorkSliceMs = Math.max(maxWorkSliceMs, before - last);
          yields++;
          await scheduler.yieldToHost();
          const after = clock();
          yieldWaitMs += after - before;
          last = after;
        },
      });
      const end = clock();
      checkCancellation(signal);
      maxWorkSliceMs = Math.max(maxWorkSliceMs, end - last);
      if (!result.eligible || result.issues.length || result.diagnostics.length)
        throw new Error('Profile preparation failed: ' + JSON.stringify(result.issues));
      samples.push({
        managedEvents,
        temperature,
        sample: index,
        factoryMs: round(factoryMs),
        elapsedMs: round(end - start),
        computeMs: round(end - start - yieldWaitMs),
        yieldWaitMs: round(yieldWaitMs),
        yields,
        maxWorkSliceMs: round(maxWorkSliceMs),
      });
    }
  }
  let phaseProbe = null;
  if (instrumentedFactory) {
    checkCancellation(signal);
    let waitMs = 0;
    let phases = new Map();
    const observer = {
      start(name) {
        const start = clock();
        const beforeWait = waitMs;
        return () => {
          const entry = phases.get(name) || { calls: 0, wallMs: 0, yieldWaitMs: 0 };
          entry.calls++;
          entry.wallMs += clock() - start;
          entry.yieldWaitMs += waitMs - beforeWait;
          phases.set(name, entry);
        };
      },
    };
    const evaluator = instrumentedFactory({
      schema,
      security,
      diagnostics: { console: false },
      __phaseObserver: observer,
    });
    // Warm this separate diagnostic copy once. Its timing is never mixed with the control.
    for (let index = 0; index < 2; index++) {
      checkCancellation(signal);
      phases = new Map();
      waitMs = 0;
      const start = clock();
      const result = await evaluator.prepareSubmission(snapshot, {
        managedEvents: true,
        signal,
        yieldToHost: async () => {
          const before = clock();
          await scheduler.yieldToHost();
          waitMs += clock() - before;
        },
      });
      const elapsedMs = clock() - start;
      checkCancellation(signal);
      if (!result.eligible || result.issues.length || result.diagnostics.length)
        throw new Error('Diagnostic phase preparation failed.');
      if (index === 1)
        phaseProbe = {
          instrumented: true,
          elapsedMs: round(elapsedMs),
          yieldWaitMs: round(waitMs),
          phases: Object.fromEntries(
            [...phases].map(([name, entry]) => [
              name,
              {
                calls: entry.calls,
                wallMs: round(entry.wallMs),
                yieldWaitMs: round(entry.yieldWaitMs),
                activeMs: round(entry.wallMs - entry.yieldWaitMs),
              },
            ])
          ),
        };
    }
  }
  return {
    scheduler: scheduler.strategy,
    inputPolicy: 'same captured input for every core sample; no editor selection is applied',
    phaseTimingBasis: 'wall time minus explicit scheduler waits; nested phases overlap',
    timerMeanMs: round(timerSamples.reduce((sum, value) => sum + value, 0) / timerSamples.length),
    timerMaxMs: round(Math.max(...timerSamples)),
    samples,
    phaseProbe,
  };
}
