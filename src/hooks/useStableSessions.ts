import { useRef, useState } from 'react';
import { EmbySession } from '../types/emby';

/**
 * Maintains a stable, insertion-ordered list of active sessions.
 *
 * - New sessions are appended to the end (first-come, first-served).
 * - Existing sessions are updated in-place (matched by DeviceId) so card
 *   positions never change on a data refresh.
 * - Sessions that disappear from the server are removed.
 *
 * Returns a stable array reference only when content actually changes,
 * so downstream components don't re-render unnecessarily.
 */
export function useStableSessions(incoming: EmbySession[]): EmbySession[] {
  // Ordered list of DeviceIds — defines stable card positions
  const orderRef = useRef<string[]>([]);
  const [stable, setStable] = useState<EmbySession[]>([]);

  const incomingIds = new Set(incoming.map((s) => s.DeviceId));
  const incomingMap = new Map(incoming.map((s) => [s.DeviceId, s]));

  // Remove gone sessions from the order
  const nextOrder = orderRef.current.filter((id) => incomingIds.has(id));

  // Append brand-new sessions in the order they appear in the incoming array
  for (const s of incoming) {
    if (!nextOrder.includes(s.DeviceId)) {
      nextOrder.push(s.DeviceId);
    }
  }

  // Build the new stable array in the preserved order
  const nextStable = nextOrder
    .map((id) => incomingMap.get(id))
    .filter((s): s is EmbySession => s !== undefined);

  // Only update state if something actually changed
  const changed =
    nextOrder.length !== orderRef.current.length ||
    nextOrder.some((id, i) => id !== orderRef.current[i]) ||
    nextStable.some((s, i) => s !== stable[i]);

  if (changed) {
    orderRef.current = nextOrder;
    // Use a functional update so React batches correctly
    setStable(nextStable);
    return nextStable;
  }

  return stable;
}
