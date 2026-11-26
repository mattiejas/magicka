import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { build, checkAttacks } from '../../content/build';
import { MONSTERS as AUTHORED_MONSTERS } from '../../content/src/items';
import { MAPS as AUTHORED } from '../../content/src/maps';
import { groundHeight, MAPS, NODES, QUESTS, type QuestPlace } from '../src';

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
      // Fishing spots lie on the water, not the ground.
      ...map.nodes.filter(n => NODES[n.type].kind !== 'spot').map(n => ({ ...n, size: NODES[n.type].size })),
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
it('refuses an attack whose shape is missing or unknown', () => {
  const boss = (id: string, shape?: string) =>
    [
      {
        id: 'b',
        boss: { attacks: [{ id, shape, name: 'Test' }] },
      },
    ] as never;
  expect(() => checkAttacks(Object.values(AUTHORED_MONSTERS))).not.toThrow();
  expect(() => checkAttacks(boss('boulder', 'square'))).not.toThrow();
  expect(() => checkAttacks(boss('melee'))).not.toThrow();
  expect(() => checkAttacks(boss('boulder', 'blob'))).toThrow();
  expect(() => checkAttacks(boss('quake'))).toThrow();
  expect(() => checkAttacks(boss('melee', 'square'))).toThrow();
});
it('each Stranded step marks the place where it is done', () => {
  const [mine, hull, fittings, sail, sword, ration, gnashclaw, wheel] = QUESTS.find(
    q => q.id === 'stranded',
  )!.steps.map(step => step.place);
  const near = (place: QuestPlace, x: number, y: number) => Math.hypot(place.x - x, place.y - y) <= place.r;
  const island = MAPS.island;
  const hasNode = (place: QuestPlace, type: string) =>
    island.nodes.some(n => n.type === type && near(place, n.x, n.y));
  const hasStation = (place: QuestPlace, type: string) =>
    island.stations.some(s => s.type === type && near(place, s.x, s.y));
  expect(hasNode(mine, 'rock_1')).toBe(true);
  expect(hasNode(hull, 'tree_1')).toBe(true);
  expect(hasStation(fittings, 'furnace')).toBe(true);
  expect(hasNode(sail, 'plant_1')).toBe(true);
  expect(hasStation(sword, 'anvil')).toBe(true);
  expect(hasStation(ration, 'fire')).toBe(true);
  expect(island.spawns.some(s => s.type === 'gnashclaw' && near(gnashclaw, s.x, s.y))).toBe(true);
  expect(hasStation(wheel, 'dock')).toBe(true);
  for (const place of [mine, hull, fittings, sail, sword, ration, gnashclaw, wheel]) {
    expect(place.map).toBe('island');
    const open = island.blocked.some(
      (blocked, i) => !blocked && near(place, i % island.size, Math.floor(i / island.size)),
    );
    expect(open, `${place.x},${place.y} can be reached`).toBe(true);
  }
});
