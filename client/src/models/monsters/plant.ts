// Plants: a toothed flower on a stalk.
import type { MonsterDef } from '@magicka/shared';
import { ball, blob, cone, merge, part, shade, taper, torus } from '../../geo';
import { pivot, ring } from '../model';
import { eyes } from './parts';
import type { MonsterShape } from './shape';

export function plant({ color: c }: MonsterDef): MonsterShape {
  const body = pivot(
    merge([
      part(
        taper(
          [
            [0, 0, 0],
            [0.1, 0.3, -0.06],
            [-0.04, 0.6, 0],
            [0, 0.82, 0.04],
          ],
          0.13,
          0.085,
        ),
        shade(c, 0.75),
      ),
      part(blob(0.3, 0.1, 3), c, [0, 0.95, 0.04]),
      part(torus(0.14, 0.055), '#cf6a62', [0, 0.95, 0.3]),
      part(ball(0.13), '#3a2028', [0, 0.95, 0.25], [0, 0, 0], [1, 1, 0.6]),
      ...ring(8).map(a =>
        part(
          cone(0.025, 0.09),
          '#f3ead6',
          [Math.cos(a) * 0.12, 0.95 + Math.sin(a) * 0.12, 0.35],
          [Math.PI / 2, 0, 0],
        ),
      ),
      ...ring(9).map(a =>
        part(
          blob(0.13, 0.1, a),
          shade('#c9605a', 0.95),
          [Math.cos(a) * 0.32, 0.95 + Math.sin(a) * 0.32, 0.02],
          [0, 0, a],
          [1.4, 0.75, 0.3],
        ),
      ),
      ...eyes(0.13, 1.2, 0.18, 0.045),
      ...ring(7).map((a, i) =>
        part(
          taper(
            [
              [0, 0.06, 0],
              [Math.cos(a) * 0.3, 0.26, Math.sin(a) * 0.3],
              [Math.cos(a) * 0.58, 0.05 + (i % 2) * 0.06, Math.sin(a) * 0.58],
            ],
            0.085,
            0.008,
          ),
          shade(c, 0.85 + (i % 3) * 0.1),
          [0, 0, 0],
          [0, 0, 0],
          [1, 1, 1],
        ),
      ),
    ]),
    0,
    0,
  );
  body.scale.set(1.15, 1.1, 1.15);
  return { parts: { body }, height: 1.45 };
}
