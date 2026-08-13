import { useEffect, useRef } from 'react';
import { acquireSocket, releaseSocket } from '../lib/socket';

// Re-runs a page's own data-fetch whenever the backend pushes a notification:new event over the
// shared Socket.io connection (lib/socket.ts) — every server action that affects a page's data
// (a withdrawal processed, a new support message, ...) already creates a notification as a side
// effect, so this is a generic "something changed, refetch" hook rather than one keyed to
// specific notification types.
//
// onEvent is read through a ref rather than being a dependency of the effect below — callers
// typically pass an inline function that's a new identity on every render, and resubscribing on
// every render would mean briefly dropping the listener (and any event in that gap) each time.
export function useSocketRefetch(onEvent: () => void): void {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const socket = acquireSocket();
    if (!socket) return undefined;

    const handler = () => callbackRef.current();
    socket.on('notification:new', handler);

    return () => {
      socket.off('notification:new', handler);
      releaseSocket();
    };
  }, []);
}
