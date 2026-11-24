// Crabs: a domed shell with barnacles, stalked eyes and two heavy claws.
import type { MonsterDef } from '@magicka/shared';
import { ball, blob, lathe, merge, part, shade, taper } from '../../geo';
import { type Geometry, pivot, ring, SIDES } from '../model';
import type { MonsterShape } from './shape';

export function crab({ color: c }: MonsterDef): MonsterShape {
  const light = shade(c, 1.2);
  const shell: Geometry[] = [
    part(
      lathe(
        [
          [0.02, 0.48],
          [0.45, 0.44],
          [0.88, 0.18],
          [0.95, 0],
          [0.8, -0.16],
          [0.3, -0.24],
          [0.02, -0.24],
        ],
        16,
      ),
      c,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 0.82],
    ),
    part(
      lathe(
        [
          [0.9, -0.1],
          [0.97, 0],
          [0.9, 0.1],
        ],
        16,
      ),
      light,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 0.83],
    ),
    ...ring(11).map((a, i) =>
      part(
        ball(0.06 + (i % 3) * 0.02),
        shade(c, 0.75),
        [Math.cos(a) * (0.3 + (i % 3) * 0.16), 0.42 - (i % 3) * 0.06, Math.sin(a) * (0.26 + (i % 3) * 0.12)],
        [0, 0, 0],
        [1, 0.5, 1],
      ),
    ),
    ...(
      [
        [0.42, 0.42, -0.18, 0.17],
        [-0.36, 0.44, -0.28, 0.13],
        [-0.1, 0.47, -0.42, 0.1],
      ] as const
    ).map(([x, y, z, r]) =>
      part(
        lathe([
          [r, 0],
          [r * 0.85, r * 0.7],
          [r * 0.5, r * 1.2],
          [r * 0.35, r * 1.1],
          [r * 0.3, r * 0.7],
        ]),
        '#a9b5ad',
        [x, y - 0.06, z],
        [z, 0, -x * 0.5],
      ),
    ),
  ];
  // Eyes and legs on both sides, then the mouth.
  for (const s of SIDES) {
    shell.push(
      part(
        taper(
          [
            [s * 0.24, 0.26, 0.6],
            [s * 0.26, 0.5, 0.7],
            [s * 0.27, 0.64, 0.72],
          ],
          0.06,
          0.05,
        ),
        c,
      ),
      part(ball(0.11), '#f3ecd8', [s * 0.27, 0.7, 0.73]),
      part(ball(0.06), '#26231f', [s * 0.27, 0.71, 0.82]),
    );
    for (let i = 0; i < 4; i++) {
      const z = 0.42 - i * 0.28;
      shell.push(
        part(
          taper(
            [
              [s * 0.75, -0.05, z * 0.8],
              [s * 1.12, 0.2, z],
              [s * 1.3, -0.2, z * 1.1],
              [s * 1.36, -0.58, z * 1.15],
            ],
            0.1,
            0.02,
          ),
          shade(c, 0.85 + (i % 2) * 0.08),
        ),
      );
    }
  }
  for (const x of [-0.14, -0.05, 0.05, 0.14])
    shell.push(
      part(
        taper(
          [
            [x, -0.06, 0.74],
            [x * 1.3, -0.14, 0.84],
            [x, -0.2, 0.84],
          ],
          0.035,
          0.015,
        ),
        light,
      ),
    );
  const claw = (s: number) => {
    const joint = pivot(
      merge([
        part(
          taper(
            [
              [0, 0, 0],
              [s * 0.3, 0.06, 0.2],
              [s * 0.18, 0, 0.55],
            ],
            0.14,
            0.12,
          ),
          shade(c, 0.92),
        ),
        part(blob(0.3, 0.07, 2), c, [s * 0.1, 0.02, 0.78], [0, 0, 0], [0.85, 0.8, 1.15]),
        part(
          taper(
            [
              [s * 0.24, 0.02, 0.9],
              [s * 0.34, 0.04, 1.2],
              [s * 0.1, 0.02, 1.46],
            ],
            0.15,
            0.015,
          ),
          light,
        ),
        part(
          taper(
            [
              [s * -0.08, 0.02, 0.92],
              [s * -0.18, 0.04, 1.15],
              [s * 0.02, 0.02, 1.36],
            ],
            0.11,
            0.012,
          ),
          light,
        ),
        ...[0, 1, 2, 3].map(i => part(ball(0.035), '#f0e2cc', [s * (0.19 - i * 0.015), 0.1, 1 + i * 0.09])),
      ]),
      s * 0.68,
      0.6,
      0.45,
    );
    joint.scale.setScalar(1.1);
    return joint;
  };
  return { parts: { body: pivot(merge(shell), 0, 0.6), la: claw(1), ra: claw(-1) }, height: 1.75 };
}
