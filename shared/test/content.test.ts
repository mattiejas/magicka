import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { build, checkAttacks } from '../../content/build';
import { MONSTERS as AUTHORED_MONSTERS } from '../../content/src/items';
import { MAPS as AUTHORED } from '../../content/src/maps';
import { MAPS } from '../src';

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
