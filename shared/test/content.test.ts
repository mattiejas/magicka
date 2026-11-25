import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { build } from '../../content/build';
import { MAPS as AUTHORED } from '../../content/src/maps';
import { groundHeight, MAPS, NODES } from '../src';

it('generated data files are up to date (npm run content)', () => {
  for (const [n, s] of Object.entries(build()))
    expect(readFileSync(new URL(`../../content/data/${n}`, import.meta.url), 'utf8') === s, n).toBe(true);
});
it('loaded maps match the authored ones', () => {
  for (const m of Object.values(AUTHORED)) {
    expect(MAPS[m.id].tiles).toEqual(m.tiles);
    expect(MAPS[m.id].blocked).toEqual(m.blocked);
  }
});
it('the island has height, and what is too steep is blocked in what both sides load', () => {
  const { island } = MAPS;
  expect(Math.max(...island.heights)).toBeGreaterThanOrEqual(10);
  expect(island.blocked.filter(Boolean).length).toBeGreaterThan(AUTHORED.island.walls.filter(Boolean).length);
  for (const [i, wall] of AUTHORED.island.walls.entries()) if (wall) expect(island.blocked[i]).toBe(1);
});
it('nothing stands on a slope that would make it float or sink', () => {
  for (const map of Object.values(MAPS)) {
    const things = [
      ...map.nodes.map(n => ({ ...n, size: NODES[n.type].size })),
      ...map.stations.map(s => ({ ...s, size: 1 })),
    ];
    for (const { x, y, size } of things) {
      const heights = [0, 0.5, 1].flatMap(i =>
        [0, 0.5, 1].map(j => groundHeight(map, x + i * size, y + j * size)),
      );
      expect(Math.max(...heights) - Math.min(...heights), `${map.id} ${x},${y}`).toBeLessThan(0.3);
    }
  }
});
