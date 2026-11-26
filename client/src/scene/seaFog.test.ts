import { MAPS } from '@driftwake/shared';
import { describe, expect, it } from 'vitest';
import { isCharted, isSeenClose } from './seaFog';

const sea = MAPS.sea;
const tileOf = (id: string) => sea.placeOf.findIndex(place => place > 0 && sea.places[place - 1].id === id);
const chart = (found: string[], landed: string[]) => ({
  full: true,
  seen: new Uint8Array(Math.ceil(sea.tiles.length / 8)),
  runs: [],
  found,
  landed,
});

describe('the chart at sea', () => {
  const pine = tileOf('pine_holm');
  it('knows the outline of a place once it is sighted, but not what is on it', () => {
    expect(isCharted(sea, chart([], []), pine)).toBe(false);
    expect(isCharted(sea, chart(['pine_holm'], []), pine)).toBe(true);
    expect(isSeenClose(sea, chart(['pine_holm'], []), pine)).toBe(false);
  });
  it('knows what is on a place once the player went ashore on it', () => {
    expect(isSeenClose(sea, chart(['pine_holm'], ['pine_holm']), pine)).toBe(true);
  });
  it('knows what it has seen up close', () => {
    const seen = chart([], []);
    seen.seen[pine >> 3] |= 1 << (pine & 7);
    expect(isSeenClose(sea, seen, pine)).toBe(true);
  });
});
