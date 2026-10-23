import { useCallback, useEffect, useRef, useState } from 'react';

/** Built-in buttons present decisions; the public controller remains preparation-only. */
export function useSubmissionReview(events) {
  const [review, setReview] = useState(null);
  const resolveRef = useRef(null);
  const controllerRef = useRef(events.controller);
  controllerRef.current = events.controller;
  const choose = useCallback((action) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setReview(null);
    resolve?.(action);
  }, []);
  useEffect(() => {
    setReview(null);
    return () => {
      resolveRef.current?.('cancel');
      resolveRef.current = null;
    };
  }, [events.controller]);
  const page = useCallback(
    async (offset) => {
      const current = review;
      if (!current) return;
      const result = await controllerRef.current?.getSaveChanges({
        preparationId: current.preparationId,
        offset,
        limit: 50,
      });
      setReview((live) =>
        live?.preparationId === current.preparationId ? { ...live, page: result, offset } : live
      );
    },
    [review]
  );
  const prepare = useCallback(
    async (intent) => {
      const controller = controllerRef.current;
      let result = await events.prepare(intent);
      while (result?.status === 'requires_decision') {
        const details = await controller.getSaveChanges({
          preparationId: result.preparationId,
          offset: 0,
          limit: 50,
        });
        const action = await new Promise((resolve) => {
          resolveRef.current = resolve;
          setReview({ ...result, page: details, offset: 0 });
        });
        result = await controller.prepareSave({
          intent,
          decision: { reviewId: result.reviewId, action },
        });
      }
      return result;
    },
    [events.prepare]
  );
  return { review, choose, page, prepare };
}
