// The torso with body wear, and the hips.
import type * as THREE from 'three';
import { gem, loft, merge, part, rbox, sculpt, shade } from '../../geo';
import { type Geometry, pivot } from '../model';
import type { BodyWear, Outfit } from './outfit';
import { chip, grow, HIP, STRAP, TORSO, torsoShape } from './plan';

export function torso(outfit: Outfit): Geometry[] {
  const { skin, body, bodyWear } = outfit;
  const parts: Geometry[] = [
    part(sculpt(TORSO, 16, torsoShape), skin),
    part(
      loft(
        [
          [0.47, 0.078, 0.062, -0.014],
          [0.53, 0.052, 0.052, -0.008],
          [0.6, 0.05, 0.05, 0.004],
        ],
        8,
      ),
      skin,
    ),
    ...(body ? [] : [part(gem(0.011), shade(skin, 0.6), [0, 0.135, 0.088], [0, 0, 0], [0.8, 1.2, 0.4])]),
  ];
  if (!body || !bodyWear) return parts;
  const { color } = body;
  const thickness = bodyWear === 'plate' ? 0.022 : 0.013;
  const firstRing = bodyWear === 'robe' ? 1 : 2;
  parts.push(part(sculpt(grow(TORSO, thickness, firstRing, 10), 16, torsoShape), color));
  return [...parts, ...BODY_TRIM[bodyWear](color)];
}

const BODY_TRIM: Record<BodyWear, (color: string) => Geometry[]> = {
  plate: color => [
    part(
      loft(
        [
          [0.18, 0.15, 0.118, 0.01],
          [0.33, 0.19, 0.145, 0.014],
          [0.43, 0.185, 0.125, 0.006],
        ],
        8,
      ),
      shade(color, 1.1),
    ),
    part(
      loft(
        [
          [0.48, 0.1, 0.085, -0.01],
          [0.535, 0.085, 0.08, -0.008],
        ],
        8,
      ),
      shade(color, 0.85),
    ),
    part(rbox(0.31, 0.05, 0.23, 0.02), STRAP, [0, 0.1, 0]),
  ],
  leather: color => [
    part(rbox(0.045, 0.52, 0.02), STRAP, [0, 0.27, 0.13], [0, 0, 0.6]),
    part(
      loft(
        [
          [0.48, 0.095, 0.08, -0.01],
          [0.535, 0.078, 0.075, -0.008],
        ],
        8,
      ),
      shade(color, 0.8),
    ),
    part(rbox(0.32, 0.055, 0.24, 0.02), STRAP, [0, 0.07, 0]),
    part(rbox(0.09, 0.09, 0.07, 0.02), shade(STRAP, 1.2), [0.13, 0.03, 0.09]),
  ],
  robe: color => [
    part(
      loft(
        [
          [0.43, 0.135, 0.105],
          [0.51, 0.085, 0.08, -0.008],
          [0.545, 0.095, 0.09, -0.008],
        ],
        8,
      ),
      shade(color, 0.8),
    ),
    part(rbox(0.05, 0.46, 0.02), shade(color, 0.72), [0, 0.22, 0.125]),
    part(
      loft(
        [
          [0.07, 0.162, 0.118],
          [0.13, 0.152, 0.11],
        ],
        10,
      ),
      shade(color, 0.62),
    ),
  ],
};

/** The waist of the shorts or trousers. It hangs on the hips, so it stays with the legs when the torso swings. */
export function hipJoint({ legs, body, cloth, bodyWear, legWear }: Outfit): THREE.Group {
  const color = legs?.color ?? cloth;
  const joint = pivot(
    merge([
      part(
        sculpt(
          [
            [-0.13, 0.02, 0.05],
            [-0.09, 0.1, 0.092],
            [-0.03, 0.172, 0.12],
            [0.03, 0.17, 0.122],
            [0.085, 0.154, 0.112],
          ],
          16,
          chip(0.03),
        ),
        color,
      ),
      part(
        loft(
          [
            [0.07, 0.158, 0.116],
            [0.1, 0.152, 0.11],
          ],
          16,
        ),
        legs ? STRAP : shade(color, 0.88),
      ),
    ]),
    0,
    HIP,
  );
  if (legWear === 'skirt' || bodyWear === 'robe') {
    const hem = loft(
      [
        [0.07, 0.156, 0.116],
        [-0.1, 0.188, 0.16],
        [-0.36, 0.25, 0.23],
        [-0.6, 0.29, 0.27],
      ],
      11,
      (a, i) => 1 + (i > 1 ? Math.sin(a * 5) * 0.06 : 0),
    );
    joint.add(pivot(part(hem, legWear === 'skirt' ? color : shade(body!.color, 0.92)), 0, 0));
  }
  return joint;
}
