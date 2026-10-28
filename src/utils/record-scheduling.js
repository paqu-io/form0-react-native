/** Private host-task scheduling. Native immediates are microtasks and cannot yield to input. */
export function createRecordScheduler({ signal } = {}) {
  if (typeof globalThis.scheduler?.postTask === 'function')
    return {
      strategy: 'post-task',
      yieldToHost: () => globalThis.scheduler.postTask(() => {}, { priority: 'user-visible' }),
    };
  if (typeof globalThis.requestIdleCallback === 'function')
    return {
      strategy: 'idle-callback',
      yieldToHost: () =>
        new Promise((resolve, reject) => {
          if (signal?.aborted) return resolve();
          let handle;
          let pending = true;
          const finish = () => {
            if (!pending) return;
            pending = false;
            signal?.removeEventListener('abort', abort);
            resolve();
          };
          const abort = () => {
            if (handle !== undefined) globalThis.cancelIdleCallback?.(handle);
            // Core checks cancellation immediately after this wait. Resolve even when
            // the host is busy and has not delivered the queued idle callback yet.
            finish();
          };
          signal?.addEventListener('abort', abort, { once: true });
          try {
            handle = globalThis.requestIdleCallback(finish, { timeout: 50 });
          } catch (error) {
            pending = false;
            signal?.removeEventListener('abort', abort);
            reject(error);
          }
        }),
    };
  return {
    strategy: 'timer',
    yieldToHost: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };
}
