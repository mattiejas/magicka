// The player's chart of the sea, pieced together from what the server sends.
import type { ChartUpdate } from '@driftwake/shared';

/** Applies an update to the chart known so far. A whole chart replaces it. */
export function mergeChart(known: ChartUpdate | null, update: ChartUpdate): ChartUpdate {
  if (update.full || !known) return { ...update, runs: [] };
  const seen = known.seen.slice();
  for (let i = 0; i + 1 < update.runs.length; i += 2)
    for (let tile = update.runs[i]; tile < update.runs[i] + update.runs[i + 1]; tile++)
      seen[tile >> 3] |= 1 << (tile & 7);
  return { full: true, seen, runs: [], found: update.found, landed: update.landed };
}

export const hasSeen = (chart: ChartUpdate, tile: number) =>
  (chart.seen[tile >> 3] & (1 << (tile & 7))) !== 0;
