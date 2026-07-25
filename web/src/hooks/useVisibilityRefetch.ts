import { useEffect } from 'react';

// Re-runs `callback` whenever the tab regains visibility (e.g. an admin alt-tabs back after
// checking something elsewhere) so dashboard data doesn't go stale while the tab is backgrounded.
export function useVisibilityRefetch(callback: () => void): void {
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        callback();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [callback]);
}
