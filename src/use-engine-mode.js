import { useEffect, useRef } from 'react';

/** Change calculation/event mode without reconstructing the editor or replaying load. */
export function useEngineMode(engineRef, mode, notify) {
  const modeRef = useRef(mode);
  const notifyRef = useRef(notify);
  modeRef.current = mode;
  notifyRef.current = notify;
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || engine.getMode() === mode) return;
    try {
      const changed = engine.setMode(mode);
      const evaluation = changed?.then ? changed : engine.eval();
      Promise.resolve(evaluation)
        .then(() => {
          if (engineRef.current === engine) notifyRef.current(engine);
        })
        .catch((error) => {
          if (engineRef.current === engine) console.warn('form0: mode evaluation failed.', error);
        });
    } catch (error) {
      console.warn('form0: mode change failed.', error);
    }
  }, [mode, engineRef]);
  return modeRef;
}
