import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

const DEFAULT_THROTTLE_MS = 30000;

// Runs `callback` when the screen gains focus, but skips it if the screen was
// already focus-refreshed within the last `throttleMs` — avoids hammering the API
// when a user rapidly switches tabs. Manual actions (pull-to-refresh, a save inside
// the screen) should call the underlying load function directly instead of this hook,
// so they're never throttled.
export function useThrottledFocusEffect(
  callback: () => void,
  throttleMs: number = DEFAULT_THROTTLE_MS
): void {
  const lastRunRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRunRef.current < throttleMs) return;
      lastRunRef.current = now;
      callback();
    }, [callback, throttleMs])
  );
}
