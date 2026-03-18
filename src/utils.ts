/** Convert Emby ticks (100ns units) to milliseconds */
export const ticksToMs = (ticks: number): number => ticks / 10_000;

/** Convert Emby ticks to seconds */
export const ticksToSeconds = (ticks: number): number => ticks / 10_000_000;

/** Format seconds as HH:MM:SS or MM:SS */
export function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** Format ticks as a human-readable duration string */
export function formatDurationTicks(ticks: number): string {
  return formatTime(ticksToSeconds(ticks));
}

/** Format ticks as progress percentage 0-100 */
export function progressPercent(positionTicks: number, runtimeTicks: number): number {
  if (!runtimeTicks || runtimeTicks === 0) return 0;
  return Math.min(100, (positionTicks / runtimeTicks) * 100);
}

/** Capitalise first letter */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Get a human-readable item type label */
export function itemTypeLabel(type: string, item?: { SeriesName?: string; ParentIndexNumber?: number; IndexNumber?: number }): string {
  switch (type) {
    case 'Movie': return 'Movie';
    case 'Episode':
      if (item?.SeriesName) {
        const s = item.ParentIndexNumber ?? 0;
        const e = item.IndexNumber ?? 0;
        return `S${String(s).padStart(2, '0')}E${String(e).padStart(2, '0')}`;
      }
      return 'Episode';
    case 'Audio': return 'Music';
    case 'AudioBook': return 'Audiobook';
    default: return type;
  }
}
