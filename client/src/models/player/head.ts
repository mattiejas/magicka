// The face, hair and headgear.

import type * as THREE from 'three';
import { loft, merge, part, plate, rbox, shade } from '../../geo';
import { fade, HEAD, HEAD_SIDES, haircut } from '../hair';
import { type Geometry, pivot, SIDES } from '../model';
import { isHelm, type Outfit } from './outfit';

export function headJoint(outfit: Outfit): THREE.Group {
  const joint = pivot(merge([...face(outfit), ...headCover(outfit)]), 0, 0.515, 0.01);
  joint.scale.setScalar(1.04);
  return joint;
}

const face = ({ skin, hair, head }: Outfit): Geometry[] => [
  part(loft(HEAD, HEAD_SIDES), skin),
  part(
    loft(
      [
        [0.12, 0.026, 0.03, 0.102],
        [0.128, 0.031, 0.044, 0.104],
        [0.165, 0.025, 0.034, 0.098],
        [0.222, 0.018, 0.022, 0.088],
      ],
      4,
    ),
    shade(skin, 1.03),
  ),
  ...SIDES.flatMap(s => [
    part(rbox(0.02, 0.02, 0.012), '#2b2a2e', [s * 0.045, 0.187, 0.084], [-0.04, s * 0.45, 0]),
    ...(isHelm(head)
      ? []
      : [
          part(rbox(0.05, 0.015, 0.02), shade(hair, 0.8), [s * 0.04, 0.232, 0.0935], [0, s * 0.22, s * 0.04]),
          part(
            rbox(0.022, 0.014, 0.02),
            shade(hair, 0.74),
            [s * 0.066, 0.228, 0.078],
            [0, s * 0.8, -s * 0.4],
          ),
        ]),
    part(
      loft(
        [
          [-0.045, 0.008, 0.014],
          [-0.01, 0.016, 0.026, -0.004],
          [0.03, 0.02, 0.028, -0.008],
          [0.042, 0.01, 0.016, -0.01],
        ],
        5,
      ),
      shade(skin, 0.97),
      [s * 0.106, 0.18, -0.008],
      [0.1, 0, -s * 0.18],
    ),
  ]),
];

/** How far the fade reaches up the head, per haircut. */
const FADE_DEPTH = [0.8, 0.95, 0.8, 1.05];
const HELM_FADE_DEPTH = 0.9;

function headCover({ skin, hair, head, look, seed }: Outfit): Geometry[] {
  if (!head) return [...fade(skin, hair, FADE_DEPTH[look.cut]), ...haircut(look.cut, hair, seed)];
  return isHelm(head) ? [...fade(skin, hair, HELM_FADE_DEPTH), ...helm(head.color)] : hood(head.color);
}

const helm = (color: string): Geometry[] => [
  part(
    loft(
      [
        [0.232, 0.122, 0.13, -0.006],
        [0.29, 0.12, 0.13, -0.01],
        [0.345, 0.085, 0.1, -0.014],
        [0.385, 0.03, 0.04, -0.016],
      ],
      8,
    ),
    color,
  ),
  part(
    loft(
      [
        [0.23, 0.13, 0.138, -0.006],
        [0.258, 0.129, 0.138, -0.006],
      ],
      8,
    ),
    shade(color, 0.8),
  ),
  part(rbox(0.022, 0.1, 0.02), shade(color, 0.85), [0, 0.19, 0.14]),
  part(rbox(0.026, 0.06, 0.2, 0.01), shade(color, 1.15), [0, 0.365, -0.012]),
  ...SIDES.map(s =>
    part(
      plate(
        q => {
          q.moveTo(-0.05, 0);
          q.lineTo(0.04, 0);
          q.lineTo(0.03, -0.13);
          q.lineTo(-0.03, -0.1);
          q.closePath();
        },
        0.012,
        0.005,
      ),
      color,
      [s * 0.122, 0.235, -0.005],
      [0, -Math.PI / 2, 0],
    ),
  ),
];

const hood = (color: string): Geometry[] => [
  part(
    loft(
      [
        [0.0, 0.13, 0.1, -0.03],
        [0.08, 0.126, 0.08, -0.045],
        [0.18, 0.13, 0.085, -0.045],
        [0.25, 0.128, 0.126, -0.01],
        [0.32, 0.112, 0.12, -0.01],
        [0.37, 0.045, 0.06, -0.03],
      ],
      8,
    ),
    color,
  ),
  part(
    loft(
      [
        [0.25, 0.122, 0.132, 0.0],
        [0.285, 0.12, 0.13, 0.0],
      ],
      8,
    ),
    shade(color, 0.8),
  ),
  ...SIDES.map(s =>
    part(
      loft(
        [
          [0.02, 0.02, 0.04],
          [0.14, 0.018, 0.045],
          [0.25, 0.018, 0.03],
        ],
        5,
      ),
      shade(color, 0.88),
      [s * 0.112, 0, 0.04],
    ),
  ),
];
