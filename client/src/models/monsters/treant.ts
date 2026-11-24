// Treants: a gnarled trunk with a face, roots, crown and two heavy limbs.
import type { MonsterDef } from '@magicka/shared';
import { ball, blob, cone, lathe, merge, part, shade, taper } from '../../geo';
import { type Geometry, pivot, ring } from '../model';
import type { MonsterShape } from './shape';

const LEAF = '#7f9a58';

/** A trunk with vertical ridges. */
function trunk(): Geometry {
  const geometry = lathe(
    [
      [1.25, 0],
      [0.98, 0.35],
      [0.82, 1],
      [0.84, 1.8],
      [0.74, 2.4],
      [0.5, 3],
    ],
    16,
  );
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const angle = Math.atan2(z, x);
    const ridge = 1 + 0.06 * Math.sin(angle * 9 + p.getY(i) * 0.8) + 0.03 * Math.sin(angle * 17);
    p.setXYZ(i, x * ridge, p.getY(i), z * ridge);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function treant({ color: c }: MonsterDef): MonsterShape {
  const body = pivot(
    merge([
      part(trunk(), c),
      ...[-1, 1].flatMap(s => [
        part(ball(0.24), '#26241b', [s * 0.33, 2.02, 0.68], [0, 0, s * 0.3], [1, 0.75, 0.6]),
        part(ball(0.13), '#f0c55e', [s * 0.33, 2.02, 0.8], [0, 0, 0], [1, 0.8, 0.6]),
        part(
          taper(
            [
              [s * 0.1, 2.14, 0.84],
              [s * 0.34, 2.32, 0.82],
              [s * 0.64, 2.3, 0.58],
            ],
            0.1,
            0.05,
          ),
          shade(c, 0.78),
        ),
      ]),
      part(blob(0.15, 0.2, 1), shade(c, 0.8), [0, 1.82, 0.88], [0, 0, 0], [0.8, 1.4, 0.8]),
      part(
        taper(
          [
            [-0.42, 1.42, 0.72],
            [0, 1.3, 0.86],
            [0.42, 1.42, 0.72],
          ],
          0.1,
          0.1,
        ),
        '#26241b',
        [0, 0, 0],
      ),
      ...[-0.24, -0.08, 0.08, 0.24].map(x =>
        part(cone(0.05, 0.16), '#cdbf9a', [x, 1.33, 0.9], [Math.PI, 0, 0]),
      ),
      ...ring(9).map((a, i) =>
        part(
          taper(
            [
              [Math.cos(a) * 0.8, 0.5, Math.sin(a) * 0.8],
              [Math.cos(a) * 1.25, 0.34, Math.sin(a) * 1.25],
              [Math.cos(a + 0.2) * (1.65 + (i % 2) * 0.2), -0.05, Math.sin(a + 0.2) * 1.7],
            ],
            0.27,
            0.04,
          ),
          shade(c, 0.8 + (i % 3) * 0.08),
        ),
      ),
      part(blob(1.05, 0.2, 2), LEAF, [0, 3.55, 0], [0, 0, 0], [1.25, 0.8, 1.2]),
      ...ring(7).map((a, i) =>
        part(blob(0.62, 0.22, i), shade(LEAF, 0.86 + (i % 3) * 0.1), [
          Math.cos(a) * 1.05,
          3.1 + (i % 2) * 0.36,
          Math.sin(a) * 1.05,
        ]),
      ),
      ...ring(9)
        .filter(a => Math.sin(a) < 0.3)
        .map((a, i) =>
          part(
            blob(0.2, 0.3, i),
            '#8fa560',
            [Math.cos(a) * 0.85, 0.9 + (i % 3) * 0.5, Math.sin(a) * 0.85],
            [0, 0, 0],
            [1, 0.6, 1],
          ),
        ),
      ...ring(4).map((a, i) =>
        part(
          taper(
            [
              [Math.cos(a) * 0.4, 3, Math.sin(a) * 0.4],
              [Math.cos(a) * 0.8, 3.9, Math.sin(a) * 0.8],
              [Math.cos(a) * 0.9, 4.5 + i * 0.1, Math.sin(a) * 0.7],
            ],
            0.14,
            0.03,
          ),
          shade(c, 0.9),
        ),
      ),
    ]),
    0,
    0,
  );
  const arm = (s: number) => {
    const joint = pivot(
      merge([
        part(
          taper(
            [
              [0, 0, 0],
              [s * 0.3, -0.5, 0.1],
              [s * 0.1, -1.1, 0.1],
              [0, -1.6, 0.15],
            ],
            0.34,
            0.24,
          ),
          shade(c, 0.92),
        ),
        part(blob(0.4, 0.2, 3), shade(c, 0.82), [0, -1.75, 0.15]),
        ...[-1, 0, 1].map(i =>
          part(
            taper(
              [
                [i * 0.2, -1.85, 0.25],
                [i * 0.3, -2.1, 0.4],
                [i * 0.22, -2.3, 0.4],
              ],
              0.11,
              0.02,
            ),
            shade(c, 0.75),
          ),
        ),
        part(blob(0.3, 0.25, 5), LEAF, [s * 0.1, 0.05, 0], [0, 0, 0], [1.2, 0.6, 1.1]),
      ]),
      s * 0.95,
      2.4,
    );
    joint.scale.setScalar(1.1);
    return joint;
  };
  return { parts: { body, la: arm(1), ra: arm(-1) }, height: 4.6 };
}
