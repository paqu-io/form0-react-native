import { useEffect, useState } from 'react';

/** Preserve validation navigation after findings were presented in this editor. */
export function useValidationNavigation(submitCount, hasErrors) {
  const showingFindings = submitCount > 0 && Boolean(hasErrors);
  const [hasShownFindings, setHasShownFindings] = useState(false);
  useEffect(() => {
    if (submitCount === 0) setHasShownFindings(false);
    else if (showingFindings) setHasShownFindings(true);
  }, [submitCount, showingFindings]);
  return showingFindings || (submitCount > 0 && hasShownFindings);
}
