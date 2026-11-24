// The player's boat, which appears piece by piece as its parts are delivered.
import * as THREE from 'three';
import { ball, cyl, merge, part, plate, rbox, shade, taper, torus, type V3 } from '../geo';
import type { Geometry } from './model';

const WOOD = '#b08a5a';
const COPPER = '#c98554';
const PLANK_ROWS = 4;

/** `progress` gives how much of a part is delivered, from 0 to 1. */
export function boatGeo(progress: (part: string) => number): Geometry {
  const parts: Geometry[] = [keel(), ...hull(progress('hull'))];
  if (progress('fittings') >= 1) parts.push(...fittings());
  if (progress('sail') > 0) parts.push(...sail(progress('sail')));
  if (progress('rudder') >= 1) parts.push(rudder());
  return merge(parts);
}

const keel = () =>
  part(
    taper(
      [
        [0, 0.2, -1.75],
        [0, -0.14, -1.2],
        [0, -0.16, 1.2],
        [0, 0.1, 1.5],
      ],
      0.07,
      0.06,
    ),
    shade(WOOD, 0.65),
  );

/** The curve of one plank; x is -1 or 1 for the side. */
const plankCurve = (x: number, row: number): V3[] => [
  [0, 0.1 + row * 0.1, -1.62 - row * 0.06],
  [x * (0.36 + row * 0.07), -0.02 + row * 0.12, -0.9],
  [x * (0.5 + row * 0.07), -0.06 + row * 0.12, 0.2],
  [x * (0.4 + row * 0.07), -0.02 + row * 0.12, 1.4],
];

function hull(done: number): Geometry[] {
  const parts: Geometry[] = [];
  const rows = Math.floor(done * PLANK_ROWS);
  for (let r = 0; r < rows; r++)
    for (const x of [-1, 1])
      parts.push(part(taper(plankCurve(x, r), 0.075, 0.075), shade(WOOD, 0.92 + (r % 2) * 0.1)));
  if (done > 0.2) parts.push(part(rbox(0.7, 0.06, 2 * done, 0.02), shade(WOOD, 0.85), [0, -0.02, 0.1]));
  if (done >= 1)
    parts.push(
      part(rbox(0.8, 0.4, 0.08, 0.03), shade(WOOD, 0.9), [0, 0.15, 1.38]),
      ...[-0.5, 0.5].map(z => part(rbox(1.05, 0.06, 0.24, 0.02), shade(WOOD, 1.15), [0, 0.28, z])),
    );
  return parts;
}

const fittings = () => [
  ...[-0.9, 0, 0.9].flatMap(z => [-1, 1].map(x => part(ball(0.055), COPPER, [x * 0.62, 0.38, z]))),
  part(torus(0.1, 0.025), COPPER, [0, 0.35, -1.6]),
];

/** The mast with a billowing sail that unrolls as cloth is delivered. */
function sail(done: number): Geometry[] {
  const front = new THREE.PlaneGeometry(1.35, 1.4 * done, 12, 12);
  billow(front, (x, y) => 0.22 * (1 - (x / 0.7) ** 2) * (1 - (y / (0.75 * done)) ** 2));
  const back = front.clone().rotateY(Math.PI);
  billow(back, (_x, _y, z) => -z - 0.012);
  const height = 2.2 - 0.7 * done;
  return [
    part(cyl(0.04, 0.06, 2.5), shade(WOOD, 0.8), [0, 1.2, -0.1]),
    part(cyl(0.03, 0.03, 1.5), shade(WOOD, 0.8), [0, 2.25, -0.04], [0, 0, Math.PI / 2]),
    part(front, '#e6dec6', [0, height, 0]),
    part(back, '#d8cfb4', [0, height, 0]),
  ];
}

function billow(cloth: THREE.BufferGeometry, depth: (x: number, y: number, z: number) => number) {
  const p = cloth.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, depth(p.getX(i), p.getY(i), p.getZ(i)));
  cloth.computeVertexNormals();
}

const rudder = () =>
  part(
    plate(q => {
      q.moveTo(0, 0.5);
      q.lineTo(0.1, 0.5);
      q.lineTo(0.34, -0.15);
      q.quadraticCurveTo(0.2, -0.35, 0, -0.3);
      q.closePath();
    }, 0.06),
    shade(WOOD, 0.75),
    [0, 0.05, 1.45],
    [0, -Math.PI / 2, 0],
  );
