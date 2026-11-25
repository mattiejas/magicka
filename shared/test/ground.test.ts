import { describe, expect, it } from 'vitest';
import { type GameMap, groundHeight, HEIGHT_UNIT, T } from '../src';

/** A 6 by 6 map of grass with a few tiles raised. */
function mapWith(raised: Record<string, number>, water: string[] = []): GameMap {
  const size = 6;
  const tiles = new Uint8Array(size * size).fill(T.GRASS);
  const heights = new Uint8Array(size * size);
  for (const [at, height] of Object.entries(raised)) {
    const [x, y] = at.split(',').map(Number);
    heights[y * size + x] = height;
  }
  for (const at of water) {
    const [x, y] = at.split(',').map(Number);
    tiles[y * size + x] = T.WATER;
  }
  return { size, tiles, heights, blocked: new Uint8Array(size * size) } as unknown as GameMap;
}

describe('groundHeight', () => {
  it('is zero on a map without heights', () => {
    expect(groundHeight(mapWith({}), 2.3, 3.7)).toBe(0);
  });
  it('is the height of a tile at its centre', () => {
    expect(groundHeight(mapWith({ '2,2': 8 }), 2.5, 2.5)).toBeCloseTo(8 * HEIGHT_UNIT);
  });
  it('blends smoothly between tile centres', () => {
    const map = mapWith({ '2,2': 8 });
    expect(groundHeight(map, 3, 2.5)).toBeCloseTo(4 * HEIGHT_UNIT);
    expect(groundHeight(map, 3.5, 2.5)).toBeCloseTo(0);
    expect(groundHeight(map, 3, 3)).toBeCloseTo(2 * HEIGHT_UNIT);
  });
  it('does not pull a cliff down towards the water beside it', () => {
    const map = mapWith({ '2,2': 8 }, ['3,2', '3,1', '3,3']);
    expect(groundHeight(map, 3, 2.5)).toBeCloseTo(8 * HEIGHT_UNIT);
  });
  it('is zero off the map', () => {
    expect(groundHeight(mapWith({ '0,0': 8 }), -4, -4)).toBe(0);
  });
});
