// Writes the data files that the browser and the Go server both load.
import { writeFileSync } from 'node:fs';
import * as f from '../shared/src/formulas';
import * as c from './src/items';
import { MAPS } from './src/maps';
export function build(): Record<string, string> {
  const line = (o: unknown) => JSON.stringify(o, null, 1) + '\n';
  const maps = Object.values(MAPS).map(({ tiles, blocked: _b, ...m }) => ({ ...m, rows: Array.from({ length: m.size }, (_, y) => Array.from(tiles.subarray(y * m.size, (y + 1) * m.size)).join('')) }));
  const styles = ['melee', 'ranged', 'magic'] as const;
  const vectors = {
    xpForLevel: Array.from({ length: 50 }, (_, i) => [i + 1, f.xpForLevel(i + 1)]),
    levelForXp: [0, 24, 25, 114, 115, 5000, 79000, 1e9].map(x => [x, f.levelForXp(x)]),
    maxHp: [1, 10, 50].map(v => [v, f.maxHp(v)]),
    ticks: [0.5, 4, 20, 30, 180, 600].map(s => [s, f.ticks(s)]),
    styleModifier: styles.flatMap(a => [...styles, null].map(d => [a, d, f.styleModifier(a, d)])),
    hitChance: [[1, 0, 1, 0.6, 1], [50, 48, 45, 27, 1.2], [10, 8, 42, 25, 0.8], [1, 0, 99, 99, 0.8]].map(a => [...a, f.hitChance(...(a as [number, number, number, number, number]))]),
    maxHit: [[1, 0], [10, 8], [50, 50.5], [33, 17]].map(([a, b]) => [a, b, f.maxHit(a, b)]),
    bossMaxHp: [0, 1, 2, 5, 20].map(n => [900, n, f.bossMaxHp(900, n)]),
    gatherChance: [[1, 1, 0], [50, 1, 5], [20, 20, 2]].map(([a, b, d]) => [a, b, d, f.gatherChance(a, b, d)]),
    mulberry: (() => { const r = mulberry(5); return Array.from({ length: 5 }, () => r()); })(),
    defaultLook: ['testtest', 'TestA', 'Robin', 'x_9'].map(n => [n, c.defaultLook(n).cut, c.defaultLook(n).color]),
  };
  return {
    'content.json': line({ items: Object.values(c.ITEMS), recipes: c.RECIPES, nodes: Object.values(c.NODES), monsters: Object.values(c.MONSTERS), boatParts: c.BOAT_PARTS, metals: c.METALS, haircuts: c.HAIRCUTS, hairColors: c.HAIR_COLORS }),
    'maps.json': line(maps), 'vectors.json': line(vectors),
  };
}
import { mulberry } from './src/maps';
if (process.argv[1]?.endsWith('build.ts')) for (const [n, s] of Object.entries(build())) writeFileSync(new URL(`./data/${n}`, import.meta.url), s);
