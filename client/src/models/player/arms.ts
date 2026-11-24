// Arms, hands and sleeves.
import * as THREE from 'three';
import { loft, merge, part, type Ring, sculpt, shade, taper } from '../../geo';
import { type Geometry, type Model, pivot } from '../model';
import type { BodyWear, Outfit } from './outfit';
import { chip, FOREARM, grow, SHOULDER, STRAP, UPPER_ARM } from './plan';

/** A relaxed hand with curled fingers. `s` is 1 for the left side and -1 for the right. */
const fingers = (skin: string, s: number): Geometry[] => [
  part(
    loft(
      [
        [0.015, 0.026, 0.026],
        [-0.03, 0.024, 0.042, 0.004],
        [-0.075, 0.02, 0.042, 0.006],
      ],
      9,
    ),
    skin,
    [0, -0.215, 0],
  ),
  ...[0, 1, 2, 3].map(i =>
    part(
      taper(
        [
          [0, -0.28, 0.038 - i * 0.022],
          [-s * 0.004, -0.318 + i * 0.004, 0.044 - i * 0.02],
          [-s * 0.026, -0.338 + i * 0.006, 0.046 - i * 0.018],
        ],
        0.0125,
        0.009,
        5,
        4,
      ),
      shade(skin, 0.97),
    ),
  ),
  part(
    taper(
      [
        [0, -0.232, 0.04],
        [-s * 0.012, -0.268, 0.066],
        [-s * 0.024, -0.298, 0.064],
      ],
      0.0145,
      0.01,
      5,
      4,
    ),
    skin,
  ),
];

interface ArmParts {
  upper: Geometry[];
  fore: Geometry[];
}

/** `s` is 1 for the left side and -1 for the right. */
const ARM_WEAR: Record<BodyWear, (color: string, s: number) => ArmParts> = {
  leather: (color, s) => ({
    upper: [
      part(
        loft(
          [
            [0.055, 0.04, 0.05],
            [0.025, 0.074, 0.08],
            [-0.05, 0.08, 0.082],
          ],
          7,
        ),
        shade(color, 0.8),
        [s * 0.008, 0, 0],
      ),
    ],
    fore: [part(sculpt(grow(FOREARM, 0.013, 1), 12), STRAP)],
  }),
  plate: (color, s) => ({
    upper: [
      part(
        loft(
          [
            [0.07, 0.035, 0.045],
            [0.04, 0.085, 0.092],
            [-0.04, 0.095, 0.098],
            [-0.07, 0.085, 0.088],
          ],
          7,
        ),
        shade(color, 1.1),
        [s * 0.012, 0, 0],
      ),
      part(sculpt(grow(UPPER_ARM, 0.008, 3), 12), shade(color, 0.75)),
    ],
    fore: [part(sculpt(grow(FOREARM, 0.018, 0), 12), color)],
  }),
  robe: color => ({
    upper: [part(sculpt(grow(UPPER_ARM, 0.016), 12), color)],
    fore: [
      part(
        loft(
          [
            [0.03, 0.054, 0.056],
            [-0.08, 0.066, 0.07],
            [-0.19, 0.088, 0.096],
          ],
          8,
        ),
        color,
      ),
      part(
        loft(
          [
            [-0.17, 0.089, 0.097],
            [-0.2, 0.091, 0.1],
          ],
          8,
        ),
        shade(color, 0.75),
      ),
    ],
  }),
};

export function addArm(
  parts: Model['parts'],
  name: 'la' | 'ra',
  s: number,
  { skin, body, bodyWear }: Outfit,
) {
  const hasSleeve = bodyWear === 'robe' || bodyWear === 'leather';
  const sleeve = hasSleeve ? shade(body!.color, 0.95) : skin;
  const wear = bodyWear ? ARM_WEAR[bodyWear](body!.color, s) : { upper: [], fore: [] };
  const upperArm: Geometry[] = [
    part(
      sculpt(
        UPPER_ARM.map(([y, x, z, oz, ox = 0]): Ring => [y, x, z, oz, ox * s]),
        11,
        chip(0.045),
      ),
      sleeve,
    ),
  ];
  const forearm: Geometry[] = [part(sculpt(FOREARM, 11, chip(0.045)), skin), ...fingers(skin, s)];
  const shoulder = pivot(merge([...upperArm, ...wear.upper]), s * 0.183, SHOULDER - 0.035);
  const elbow = pivot(merge([...forearm, ...wear.fore]), 0, -0.275);
  const hand = new THREE.Group();
  hand.position.set(0, -0.29, 0.02);
  elbow.add(hand);
  shoulder.add(elbow);
  parts[name] = shoulder;
  parts[`${name}2`] = elbow;
  parts[`${name}h`] = hand;
  parts.upper.add(shoulder);
}
