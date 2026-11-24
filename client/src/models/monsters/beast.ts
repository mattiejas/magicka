// Four-legged animals. One body plan with per-species measurements and features.
import type { MonsterDef } from '@magicka/shared';
import { ball, blob, capsule, cone, lathe, merge, part, plate, shade, taper } from '../../geo';
import { type Geometry, pivot, ring, SIDES } from '../model';
import { eyes } from './parts';
import type { MonsterShape } from './shape';

/** Measurements in tiles, before the model is scaled by level. */
interface Build {
  legs: number;
  /** Height of the body above the legs. */
  back: number;
  girth: number;
  length: number;
  chest: number;
  neckHeight: number;
  neckWidth: number;
  headForward: number;
  skull: number;
  snoutLength: number;
  snoutTip: number;
  snoutBase: number;
  nose: number;
  noseForward: number;
  ears: number;
  tailTip: number;
}
const COMMON: Build = {
  legs: 0.4,
  back: 0.17,
  girth: 0.22,
  length: 0.62,
  chest: 0.25,
  neckHeight: 0.1,
  neckWidth: 0.19,
  headForward: 0.2,
  skull: 0.17,
  snoutLength: 0.2,
  snoutTip: 0.075,
  snoutBase: 0.11,
  nose: 0.04,
  noseForward: 0.3,
  ears: 0.17,
  tailTip: 0.05,
};
const BUILDS: Record<string, Partial<Build>> = {
  boar: {
    legs: 0.32,
    back: 0.2,
    girth: 0.27,
    length: 0.42,
    chest: 0.29,
    headForward: 0.16,
    skull: 0.22,
    snoutTip: 0.1,
    snoutBase: 0.13,
    nose: 0.075,
    noseForward: 0.28,
  },
  wolf: { legs: 0.46, girth: 0.18, chest: 0.21, snoutLength: 0.27, ears: 0.24 },
  stag: { legs: 0.52, neckHeight: 0.42, neckWidth: 0.15, tailTip: 0.03 },
};
const BONE = '#d4c8ae';
const IVORY = '#efe6d2';
const ANTLER_HEIGHT = 0.45;

export function beast({ id, color, level }: MonsterDef): MonsterShape {
  const build = { ...COMMON, ...BUILDS[id] };
  const bodyHeight = build.legs + build.back;
  const body = pivot(merge([...torso(build, color), ...torsoFeatures(id, build, color)]), 0, bodyHeight);
  const parts: MonsterShape['parts'] = { body };
  if (id === 'drake')
    for (const side of SIDES) {
      const wing = drakeWing(side, color);
      body.add(wing);
      parts[side > 0 ? 'leftWing' : 'rightWing'] = wing;
    }
  parts.head = pivot(
    merge([...head(id, build, color), ...headFeatures(id, build)]),
    0,
    bodyHeight + 0.04,
    0.36,
  );
  parts.head.scale.setScalar(1.12);
  parts.ll = leg(build, color, 0.15, 0.26);
  parts.rl = leg(build, color, -0.15, 0.26);
  parts.rb = leg(build, color, 0.15, -0.26);
  parts.lb = leg(build, color, -0.15, -0.26);
  const scale = 0.9 + Math.min(0.55, level / 80);
  const height = (bodyHeight + 0.55 + (id === 'stag' ? ANTLER_HEIGHT : 0)) * scale;
  return { parts, height, scale };
}

const dark = (color: string) => shade(color, 0.72);
const light = (color: string) => shade(color, 1.2);

function torso({ girth, length, chest }: Build, color: string): Geometry[] {
  return [
    part(capsule(girth, length), color, [0, 0, 0], [Math.PI / 2, 0, 0], [1, 1, 1.02]),
    part(ball(chest, true), color, [0, 0.05, 0.22], [0, 0, 0], [1, 1.02, 1]),
    part(ball(0.2), light(color), [0, -0.1, 0.02], [0, 0, 0], [0.9, 0.7, 1.7]),
  ];
}

function torsoFeatures(id: string, build: Build, color: string): Geometry[] {
  switch (id) {
    case 'boar':
      return [...bristles(color), curlyTail(color)];
    case 'drake':
      return [drakeTail(color), ...backPlates(color)];
    case 'thornback':
      return [hangingTail(build, color), ...thorns()];
    case 'wolf':
      return [hangingTail(build, color), ...mane(color)];
    default:
      return [hangingTail(build, color)];
  }
}

const bristles = (color: string) =>
  [0, 1, 2, 3, 4, 5, 6].map(i =>
    part(
      cone(0.035, 0.15, 6),
      dark(color),
      [0, 0.28 - Math.abs(i - 3) * 0.008, 0.36 - i * 0.12],
      [-0.4, 0, 0],
    ),
  );

const curlyTail = (color: string) =>
  part(
    taper(
      [
        [0, 0.1, -0.5],
        [0.04, 0.16, -0.58],
        [-0.02, 0.12, -0.63],
      ],
      0.025,
      0.012,
      6,
    ),
    dark(color),
  );

const drakeTail = (color: string) =>
  part(
    taper(
      [
        [0, 0, -0.4],
        [0, 0.02, -0.75],
        [0.12, 0.1, -1.05],
        [0.2, 0.16, -1.3],
      ],
      0.17,
      0.02,
    ),
    color,
  );

const backPlates = (color: string) =>
  [0, 1, 2, 3, 4, 5].map(i =>
    part(
      cone(0.05, 0.16, 6),
      light(color),
      [0, 0.25 - (i > 3 ? (i - 3) * 0.06 : 0), 0.3 - i * 0.2],
      [-0.4, 0, 0],
    ),
  );

const hangingTail = ({ tailTip }: Build, color: string) =>
  part(
    taper(
      [
        [0, 0.06, -0.45],
        [0, 0.04, -0.62],
        [0.03, -0.1, -0.78],
      ],
      0.075,
      tailTip,
    ),
    dark(color),
  );

const thorns = () =>
  [0, 1, 2, 3, 4].flatMap(row =>
    [-1, 0, 1].map(side =>
      part(
        cone(0.05, 0.3),
        shade('#4f5636', 0.9 + (row % 2) * 0.2),
        [side * 0.16, 0.24 - Math.abs(side) * 0.06, 0.32 - row * 0.17],
        [-0.35, 0, -side * 0.5],
      ),
    ),
  );

const mane = (color: string) =>
  ring(8).map((angle, i) =>
    part(blob(0.12, 0.3, i), shade(color, 0.85 + (i % 2) * 0.15), [
      Math.cos(angle) * 0.16,
      0.06 + Math.sin(angle) * 0.16,
      0.36,
    ]),
  );

function drakeWing(side: number, color: string) {
  const arm = taper(
    [
      [0, 0, 0],
      [side * 0.4, 0.3, 0],
      [side * 0.85, 0.2, -0.1],
    ],
    0.04,
    0.015,
  );
  const skin = plate(
    shape => {
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.35, 0.36, 0.85, 0.2);
      shape.quadraticCurveTo(0.68, 0, 0.62, -0.16);
      shape.quadraticCurveTo(0.45, -0.06, 0.34, -0.22);
      shape.quadraticCurveTo(0.2, -0.1, 0, -0.12);
      shape.closePath();
    },
    0.012,
    0.006,
  );
  const geometry = merge([
    part(arm, dark(color)),
    part(skin, light(color), [0, 0, 0], [0, side > 0 ? 0 : Math.PI, 0]),
  ]);
  return pivot(geometry, side * 0.16, 0.18, 0.1);
}

function head(id: string, build: Build, color: string): Geometry[] {
  const { neckHeight: y, headForward: z, skull, snoutLength, snoutTip, snoutBase } = build;
  const snout = lathe([
    [0.02, snoutLength],
    [snoutTip, 0.19],
    [snoutBase, 0.05],
    [0.14, -0.06],
  ]);
  const snoutColor = id === 'boar' ? light(color) : shade(color, 1.08);
  return [
    part(ball(skull, true), color, [0, y, z], [0, 0, 0], [0.95, 0.95, 1.1]),
    part(snout, snoutColor, [0, y - 0.05, z + 0.1], [Math.PI / 2 + 0.12, 0, 0]),
    part(ball(build.nose), '#3a2f2a', [0, y - 0.05, z + build.noseForward], [0, 0, 0], [1.1, 0.8, 0.5]),
    ...eyes(0.1, y + 0.07, z + 0.13, 0.034, id === 'drake' ? '#e0b95a' : '#26231f'),
    part(
      taper(
        [
          [0, -0.02, -0.16],
          [0, y * 0.5, 0.02],
          [0, y, z],
        ],
        build.neckWidth,
        0.12,
      ),
      color,
    ),
    ...SIDES.map(side =>
      part(
        cone(0.065, build.ears),
        dark(color),
        [side * 0.12, y + 0.18, z - 0.03],
        [-0.15, 0, -side * 0.35],
        [1, 1, 0.5],
      ),
    ),
  ];
}

function headFeatures(id: string, build: Build): Geometry[] {
  switch (id) {
    case 'boar':
      return SIDES.map(side => tusk(side, build));
    case 'stag':
      return SIDES.flatMap(side => antler(side, build));
    case 'drake':
      return SIDES.map(side => horn(side, build));
    default:
      return [];
  }
}

const tusk = (s: number, { neckHeight: y, headForward: z }: Build) =>
  part(
    taper(
      [
        [s * 0.09, y - 0.1, z + 0.2],
        [s * 0.15, y - 0.06, z + 0.27],
        [s * 0.14, y + 0.05, z + 0.28],
      ],
      0.03,
      0.006,
    ),
    IVORY,
  );

const horn = (s: number, { neckHeight: y, headForward: z }: Build) =>
  part(
    taper(
      [
        [s * 0.08, y + 0.13, z - 0.02],
        [s * 0.14, y + 0.28, z - 0.16],
        [s * 0.12, y + 0.4, z - 0.34],
      ],
      0.04,
      0.008,
    ),
    BONE,
  );

function antler(s: number, { neckHeight: y, headForward: z }: Build): Geometry[] {
  const beam = taper(
    [
      [s * 0.06, y + 0.13, z],
      [s * 0.22, y + 0.35, z - 0.08],
      [s * 0.3, y + 0.62, z + 0.04],
    ],
    0.032,
    0.01,
  );
  const tines = [0.4, 0.62, 0.82].map((k, i) =>
    part(
      taper(
        [
          [s * (0.1 + k * 0.17), y + 0.16 + k * 0.36, z - 0.05],
          [s * (0.18 + k * 0.24), y + 0.28 + k * 0.4, z + 0.1 + i * 0.02],
        ],
        0.02,
        0.006,
        6,
      ),
      BONE,
    ),
  );
  return [part(beam, BONE), ...tines];
}

function leg({ legs: length }: Build, color: string, x: number, z: number) {
  const limb = lathe([
    [0.11, 0.06],
    [0.09, -0.06],
    [0.05, -length * 0.55],
    [0.055, -length + 0.05],
  ]);
  const hoof = lathe([
    [0.065, -length + 0.08],
    [0.075, -length + 0.02],
    [0.07, -length],
  ]);
  return pivot(merge([part(limb, shade(color, 0.88)), part(hoof, '#3d342c')]), x, length, z);
}
