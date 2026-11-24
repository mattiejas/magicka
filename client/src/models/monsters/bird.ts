// Chickens: a round body on two thin legs, with folded wings and a raised tail.
import type { MonsterDef } from '@driftwake/shared';
import { ball, blob, cone, merge, part, plate, shade, taper } from '../../geo';
import { type Geometry, pivot, SIDES } from '../model';
import { eyes } from './parts';
import type { MonsterShape } from './shape';

const LEG_LENGTH = 0.17;
const BODY_HEIGHT = LEG_LENGTH + 0.16;
const COMB = '#c2483c';
const BEAK = '#e0a545';
const SCALE = 1.25;

export function bird({ color }: MonsterDef): MonsterShape {
  const body = pivot(
    merge([...torso(color), ...tail(color), ...SIDES.map(side => wing(side, color))]),
    0,
    BODY_HEIGHT,
  );
  const head = pivot(merge(headShapes(color)), 0, BODY_HEIGHT + 0.06, 0.13);
  return {
    parts: { body, head, ll: leg(1), rl: leg(-1) },
    height: 0.72 * SCALE,
    scale: SCALE,
  };
}

const torso = (color: string): Geometry[] => [
  part(ball(0.19, true), color, [0, 0, 0], [-0.15, 0, 0], [0.92, 0.9, 1.2]),
  part(ball(0.13, true), shade(color, 1.1), [0, 0.02, 0.12], [0, 0, 0], [1, 1.05, 0.9]),
  part(blob(0.13, 0.12, 4), shade(color, 0.9), [0, -0.07, -0.05], [0, 0, 0], [1, 0.7, 1.2]),
];

const tail = (color: string) =>
  [-2, -1, 0, 1, 2].map(i =>
    part(
      taper(
        [
          [i * 0.02, 0.04, -0.16],
          [i * 0.045, 0.16, -0.27],
          [i * 0.06, 0.28 - Math.abs(i) * 0.03, -0.3],
        ],
        0.055,
        0.015,
        6,
      ),
      shade(color, i % 2 ? 0.72 : 0.85),
    ),
  );

function wing(side: number, color: string) {
  const feathers = plate(
    shape => {
      shape.moveTo(0.1, 0.07);
      shape.quadraticCurveTo(0.14, -0.06, 0, -0.1);
      shape.quadraticCurveTo(-0.14, -0.1, -0.22, 0.02);
      shape.quadraticCurveTo(-0.08, 0.12, 0.1, 0.07);
      shape.closePath();
    },
    0.03,
    0.015,
  );
  return part(feathers, shade(color, 0.82), [side * 0.155, 0.02, 0], [0, -Math.PI / 2, side * 0.12]);
}

const headShapes = (color: string): Geometry[] => [
  part(
    taper(
      [
        [0, -0.04, -0.02],
        [0, 0.1, 0.02],
        [0, 0.2, 0.05],
      ],
      0.11,
      0.075,
    ),
    shade(color, 1.1),
  ),
  part(ball(0.085), shade(color, 1.12), [0, 0.22, 0.06]),
  part(cone(0.035, 0.09, 6), BEAK, [0, 0.21, 0.165], [Math.PI / 2, 0, 0]),
  ...eyes(0.062, 0.245, 0.095, 0.018),
  ...[0.1, 0.055, 0.01].map((z, i) =>
    part(ball(0.03), COMB, [0, 0.305 + (i === 1 ? 0.012 : 0), z], [0, 0, 0], [0.5, 1.2, 0.9]),
  ),
  ...SIDES.map(side => part(ball(0.022), COMB, [side * 0.015, 0.155, 0.125], [0, 0, 0], [0.7, 1.5, 0.6])),
];

function leg(side: number) {
  const toes = [-0.5, 0, 0.5].map(angle =>
    part(
      taper(
        [
          [0, -LEG_LENGTH + 0.015, 0],
          [Math.sin(angle) * 0.09, -LEG_LENGTH + 0.008, Math.cos(angle) * 0.09],
        ],
        0.014,
        0.006,
        5,
      ),
      BEAK,
    ),
  );
  const shin = taper(
    [
      [0, 0.03, 0],
      [0, -LEG_LENGTH + 0.01, 0],
    ],
    0.026,
    0.014,
    6,
  );
  return pivot(merge([part(shin, BEAK), ...toes]), side * 0.075, LEG_LENGTH, 0);
}
