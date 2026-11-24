import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { build } from '../../content/build';
import { MAPS as AUTHORED } from '../../content/src/maps';
import { MAPS } from '../src';
it('generated data files are up to date (npm run content)', () => { for (const [n, s] of Object.entries(build())) expect(readFileSync(new URL(`../../content/data/${n}`, import.meta.url), 'utf8') === s, n).toBe(true); });
it('loaded maps match the authored ones', () => { for (const m of Object.values(AUTHORED)) { expect(MAPS[m.id].tiles).toEqual(m.tiles); expect(MAPS[m.id].blocked).toEqual(m.blocked); } });
