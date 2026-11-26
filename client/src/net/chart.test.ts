import { describe, expect, it } from 'vitest';
import { hasSeen, mergeChart } from './chart';

describe('the chart', () => {
  const whole = { full: true, seen: new Uint8Array([0b1, 0]), runs: [], found: ['island'], landed: [] };
  it('starts from a whole chart', () => {
    const chart = mergeChart(null, whole);
    expect(hasSeen(chart, 0)).toBe(true);
    expect(hasSeen(chart, 1)).toBe(false);
  });
  it('adds runs of newly seen tiles, and takes the places as they are', () => {
    const update = {
      full: false,
      seen: new Uint8Array(),
      runs: [6, 4],
      found: ['island', 'gull_rock'],
      landed: [],
    };
    const chart = mergeChart(mergeChart(null, whole), update);
    expect([5, 6, 9, 10].map(tile => hasSeen(chart, tile))).toEqual([false, true, true, false]);
    expect(chart.found).toEqual(['island', 'gull_rock']);
    expect(hasSeen(whole, 6)).toBe(false); // the chart it was given stays as it was
  });
});
