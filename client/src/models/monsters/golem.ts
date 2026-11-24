// Golems: piled boulders with moss.
import type { MonsterDef } from '@driftwake/shared';
import { blob, merge, part, rbox, shade, type V3 } from '../../geo';
import { pivot } from '../model';
import { eyes } from './parts';
import type { MonsterShape } from './shape';

const MOSS = '#7f9458';

export function golem({ color: c }: MonsterDef): MonsterShape {
  const stone = (radius: number, position: V3, seed = 1, tint = 1) =>
    part(blob(radius, 0.2, seed), shade(c, tint), position);
  const body = pivot(
    merge([
      stone(0.46, [0, 0.36, 0], 3),
      stone(0.3, [0.28, 0.55, -0.05], 5, 1.06),
      stone(0.3, [-0.28, 0.55, -0.05], 8, 0.96),
      stone(0.24, [0, 0.86, 0.1], 2, 1.1),
      part(rbox(0.3, 0.07, 0.1, 0.03), shade(c, 0.72), [0, 0.95, 0.28]),
      ...eyes(0.085, 0.88, 0.31, 0.035, '#e0b95a'),
      part(blob(0.22, 0.3, 4), MOSS, [0.2, 0.74, -0.1], [0, 0, 0], [1.2, 0.4, 1]),
      part(blob(0.16, 0.3, 6), MOSS, [-0.3, 0.76, 0], [0, 0, 0], [1.2, 0.4, 1]),
    ]),
    0,
    0.55,
  );
  const arm = (x: number) => {
    const joint = pivot(
      merge([
        stone(0.19, [0, -0.1, 0], 2),
        stone(0.17, [0, -0.38, 0.02], 4, 0.95),
        stone(0.23, [0, -0.68, 0.06], 7, 1.06),
      ]),
      x,
      1.08,
    );
    joint.scale.setScalar(1.1);
    return joint;
  };
  const leg = (x: number) =>
    pivot(merge([stone(0.2, [0, -0.06, 0], 5, 0.92), stone(0.2, [0, -0.33, 0.04], 9, 0.86)]), x, 0.5);
  return { parts: { body, la: arm(0.56), ra: arm(-0.56), ll: leg(0.22), rl: leg(-0.22) }, height: 1.75 };
}
