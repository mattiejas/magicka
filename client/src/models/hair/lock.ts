// One chunky lock of hair.
import * as THREE from 'three';
import type { V3 } from '../../geo';
import type { Geometry } from '../model';

const SEGMENTS = 5;
const CORNERS = 4;
const HEAD_CENTRE = new THREE.Vector3(0, 0.22, -0.012);

export interface LockShape {
  points: V3[];
  width: number;
  thickness: number;
  /** Moves the ridge sideways. */
  lean: number;
  /** How much width is left at the tip: 0 is a point. */
  blunt: number;
}

/** Full up to 40% of its length, then narrowing to the tip. */
function widthAt(t: number, blunt: number): number {
  if (t === 0) return 0.72;
  if (t <= 0.4) return 1;
  return Math.max(blunt * t, 1 - ((t - 0.4) / 0.6) ** 1.5) + 0.004;
}

/** Ridged on top and flat towards the head. */
export function lock({ points, width, thickness, lean, blunt }: LockShape): Geometry {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const centre = curve.getPoint(t);
    const along = curve.getTangent(t);
    const outwards = centre.clone().sub(HEAD_CENTRE);
    outwards.addScaledVector(along, -outwards.dot(along)).normalize();
    const sideways = new THREE.Vector3().crossVectors(along, outwards);
    const size = widthAt(t, blunt);
    const corner = (side: number, out: number) =>
      centre.clone().addScaledVector(outwards, out).addScaledVector(sideways, side);
    rings.push([
      corner(width * size, 0),
      corner(width * lean * size, thickness * size),
      corner(-width * size, 0),
      corner(0, -thickness * 0.55 * size),
    ]);
  }
  return skin(rings);
}

function skin(rings: THREE.Vector3[][]): Geometry {
  const positions: number[] = [];
  const triangle = (...corners: THREE.Vector3[]) => {
    for (const { x, y, z } of corners) positions.push(x, y, z);
  };
  for (let i = 0; i < SEGMENTS; i++)
    for (let k = 0; k < CORNERS; k++) {
      const next = (k + 1) % CORNERS;
      triangle(rings[i][k], rings[i + 1][k], rings[i][next]);
      triangle(rings[i][next], rings[i + 1][k], rings[i + 1][next]);
    }
  const [left, ridge, right, under] = rings[SEGMENTS];
  triangle(left, right, ridge);
  triangle(left, under, right);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
