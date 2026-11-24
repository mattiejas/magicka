// Wisps: floating spirits with trailing tentacles and orbiting shards.
import type { MonsterDef } from '@magicka/shared';
import { ball, gem, lathe, merge, part, shade, taper, torus } from '../../geo';
import { pivot, ring } from '../model';
import type { MonsterShape } from './shape';

const SHARDS = 3;

export function wisp({ id, color: c }: MonsterDef): MonsterShape {
  const body = pivot(
    merge([
      part(
        lathe([
          [0.02, 0.42],
          [0.16, 0.3],
          [0.27, 0.06],
          [0.22, -0.2],
          [0.1, -0.5],
          [0.01, -0.85],
        ]),
        c,
      ),
      ...ring(5).map((a, i) =>
        part(
          taper(
            [
              [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2],
              [Math.cos(a + 0.6) * 0.32, -0.32, Math.sin(a + 0.6) * 0.32],
              [Math.cos(a + 1.3) * 0.2, -0.7 - (i % 2) * 0.1, Math.sin(a + 1.3) * 0.2],
            ],
            0.07,
            0.006,
          ),
          shade(c, 0.85 + (i % 2) * 0.2),
        ),
      ),
      part(ball(0.17), '#f7f3e6', [0, 0.1, 0.13]),
      ...[-1, 1].map(s => part(ball(0.035), '#333a44', [s * 0.07, 0.13, 0.285], [0, 0, 0], [0.8, 1.4, 0.6])),
      ...(id === 'seer' ? [part(torus(0.3, 0.025), '#d9b25b', [0, 0.42, 0], [1.4, 0, 0])] : []),
    ]),
    0,
    1.05,
  );
  body.scale.set(1.15, 1.1, 1.15);
  const parts: MonsterShape['parts'] = { body };
  for (let i = 0; i < SHARDS; i++) {
    const shard = pivot(part(gem(0.07), shade(c, 1.2)), 0, 0);
    body.add(shard);
    parts[`shard${i}`] = shard;
  }
  return { parts, height: 1.6 };
}
