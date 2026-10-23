import { createRecordEvaluator } from 'form0-core';

const clock = () => globalThis.performance?.now?.() ?? Date.now();
const timerYield = () => new Promise((resolve) => setTimeout(resolve, 0));
const round = (value) => Math.round(value * 10) / 10;
function checkCancellation(signal) {
  if (signal?.aborted) throw new Error('Preparation profile cancelled.');
}

/** Diagnostic harness only: report timings, never record values or executable proposals. */
export async function profilePreparation({ schema, snapshot, security, signal }) {
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
    for (const temperature of ['cold', 'warm']) {
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
          await timerYield();
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
        factoryMs: round(factoryMs),
        elapsedMs: round(end - start),
        computeMs: round(end - start - yieldWaitMs),
        yieldWaitMs: round(yieldWaitMs),
        yields,
        maxWorkSliceMs: round(maxWorkSliceMs),
      });
    }
  }
  return {
    timerMeanMs: round(timerSamples.reduce((sum, value) => sum + value, 0) / timerSamples.length),
    timerMaxMs: round(Math.max(...timerSamples)),
    samples,
  };
}
