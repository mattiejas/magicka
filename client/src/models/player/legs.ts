// Legs, feet, shorts and leg wear.
import type * as THREE from 'three';
import { loft, merge, part, rbox, sculpt, shade } from '../../geo';
import { type Geometry, type Model, pivot } from '../model';
import type { LegWear, Outfit } from './outfit';
import { chip, grow, HIP, LEG_STRETCH, SHIN, STRAP, THIGH } from './plan';

const LEG_WEAR: Record<LegWear, (color: string) => { thigh: Geometry[]; shin: Geometry[] }> = {
  chaps: color => ({
    thigh: [part(sculpt(grow(THIGH, 0.012), 12), color)],
    shin: [part(sculpt(grow(SHIN, 0.01, 0, 6), 12), color)],
  }),
  greaves: color => ({
    thigh: [part(sculpt(grow(THIGH, 0.018, 2, 5), 12), color)],
    shin: [
      part(sculpt(grow(SHIN, 0.016, 1, 6), 12), color),
      part(
        loft(
          [
            [0.05, 0.045, 0.045],
            [0, 0.07, 0.078],
            [-0.05, 0.045, 0.05],
          ],
          7,
        ),
        shade(color, 1.12),
        [0, 0.01, 0.018],
      ),
    ],
  }),
  skirt: () => ({ thigh: [], shin: [] }),
};

/** Loose shorts: wider at the hem, with uneven folds. */
const shorts = (cloth: string): Geometry[] => [
  part(
    sculpt(
      [
        [0.085, 0.02, 0.02],
        [0.06, 0.07, 0.078],
        [0.0, 0.098, 0.112],
        [-0.12, 0.104, 0.118, 0.002],
        [-0.21, 0.108, 0.12, 0.004],
        [-0.31, 0.112, 0.122, 0.006],
      ],
      13,
      chip(0.085),
    ),
    cloth,
  ),
  part(
    loft(
      [
        [-0.29, 0.1, 0.11, 0.006],
        [-0.312, 0.1, 0.11, 0.006],
      ],
      10,
    ),
    shade(cloth, 0.7),
  ),
];

/** `thickness` is added all round, for boots. */
const foot = (color: string, thickness: number) =>
  part(
    sculpt(
      [
        [-0.445, 0.048 + thickness, 0.115 + thickness, 0.045],
        [-0.42, 0.048 + thickness, 0.112 + thickness, 0.045],
        [-0.385, 0.04 + thickness, 0.07 + thickness, 0.018],
        [-0.34, 0.036 + thickness, 0.044 + thickness, 0],
      ],
      11,
    ),
    color,
  );

const boot = (): Geometry[] => [
  foot(STRAP, 0.012),
  part(
    loft(
      [
        [-0.35, 0.055, 0.062],
        [-0.22, 0.064, 0.07, -0.014],
        [-0.19, 0.074, 0.08, -0.016],
      ],
      8,
    ),
    STRAP,
  ),
];

const TOES = [0, 1, 2, 3];
const bareFoot = (skin: string, s: number): Geometry[] => [
  foot(skin, 0),
  ...TOES.map(i =>
    part(rbox(0.019, 0.022, 0.035), skin, [
      (i - 1.5) * 0.021,
      -0.432,
      0.148 - Math.abs(i - (s > 0 ? 0.6 : 2.4)) * 0.008,
    ]),
  ),
];

export function addLeg(
  parts: Model['parts'],
  root: THREE.Group,
  name: 'll' | 'rl',
  s: number,
  outfit: Outfit,
) {
  const { skin, cloth, legs, legWear } = outfit;
  const wear = legWear ? LEG_WEAR[legWear](legs!.color) : { thigh: shorts(cloth), shin: [] };
  const trouser = legWear && legWear !== 'skirt' ? shade(legs!.color, 0.85) : skin;
  const thigh = [part(sculpt(THIGH, 12, chip(0.045)), trouser), ...wear.thigh];
  const shin = [
    part(sculpt(SHIN, 12, chip(0.045)), trouser),
    ...wear.shin,
    ...(legs ? boot() : bareFoot(skin, s)),
  ];
  const hip = pivot(lengthened(thigh), s * 0.086, HIP);
  const knee = pivot(lengthened(shin), 0, -0.4 * LEG_STRETCH);
  hip.add(knee);
  parts[name] = hip;
  parts[`${name}2`] = knee;
  root.add(hip);
}

const lengthened = (parts: Geometry[]) => merge(parts).scale(1, LEG_STRETCH, 1);
