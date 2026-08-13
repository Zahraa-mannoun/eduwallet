import { useEffect, useRef } from 'react';
import { subscribeToNotifications } from '../services/socket';
import { useAuth } from '../context/AuthContext';

// Re-runs a screen's own data-fetch whenever the backend pushes a notification:new event (see
// services/socket.ts / notifications.socket.ts) — every server action that affects a screen's
// data (a transfer approved, a card charged, a KYC decision, a withdrawal dispensed, ...) already
// creates a notification as a side effect, so this is a generic "something changed, refetch" hook
// rather than one keyed to specific notification types. Kept live for as long as the screen is
// mounted, not just while it's the focused tab, so a background tab is already fresh by the time
// the user switches to it.
//
// onNotification is read through a ref rather than being a dependency of the effect below — a
// screen typically passes an inline callback that's a new function identity on every render, and
// resubscribing on every render would mean briefly dropping the listener (and any event that
// happened to fire in that gap) each time.
export function useNotificationRefetch(onNotification: () => void): void {
  const { isAuthenticated } = useAuth();
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return subscribeToNotifications(() => callbackRef.current());
  }, [isAuthenticated]);
}
