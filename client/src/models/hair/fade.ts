// Cropped sides and back that darken from skin to hair.
import * as THREE from 'three';
import { part, shade, type V3 } from '../../geo';
import type { Geometry } from '../model';
import { clamp, mix, skullPoint } from './skull';

/** A multiple of the head's corners, so the fade never dips below the skull. */
const COLUMNS = 48;
const ROWS = 9;
const TOP = 0.333;
const FACE_ANGLE = Math.PI / 2;

/** Lowest hair at an angle away from the face: 0 is the middle of the forehead, PI the nape. */
const HAIRLINE: [angle: number, y: number][] = [
  [0, 0.292],
  [0.5, 0.29],
  [0.72, 0.275],
  [0.86, 0.245],
  [0.98, 0.232],
  [1.1, 0.17],
  [1.3, 0.165],
  [1.42, 0.228],
  [1.75, 0.23],
  [1.95, 0.18],
  [2.2, 0.13],
  [2.6, 0.1],
  [Math.PI, 0.095],
];

function hairlineAt(angle: number): number {
  for (let i = 1; i < HAIRLINE.length; i++) {
    const [fromAngle, fromY] = HAIRLINE[i - 1];
    const [toAngle, toY] = HAIRLINE[i];
    if (angle <= toAngle) return mix(fromY, toY, (angle - fromAngle) / (toAngle - fromAngle));
  }
  return HAIRLINE.at(-1)![1];
}

function fadePoint(column: number, row: number): V3 {
  const angle = (column / COLUMNS) * Math.PI * 2 + FACE_ANGLE;
  const fromFace = Math.abs(Math.atan2(Math.sin(angle - FACE_ANGLE), Math.cos(angle - FACE_ANGLE)));
  const t = row / ROWS;
  return skullPoint(angle, mix(hairlineAt(fromFace), TOP, t), 0.006 + t * 0.008);
}

function surface(positions: number[]): Geometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** A larger `depth` keeps more skin showing. */
export function fade(skin: string, hair: string, depth: number): Geometry[] {
  const parts: Geometry[] = [];
  for (let row = 0; row < ROWS; row++) {
    const positions: number[] = [];
    for (let column = 0; column < COLUMNS; column++) {
      const a = fadePoint(column, row);
      const b = fadePoint(column + 1, row);
      const c = fadePoint(column, row + 1);
      const d = fadePoint(column + 1, row + 1);
      positions.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const amount = clamp((row + 1.2) / (ROWS * depth * 0.62), 0.12, 0.94);
    const color = new THREE.Color(skin).lerp(new THREE.Color(hair), amount);
    parts.push(part(surface(positions), `#${color.getHexString()}`));
  }
  return [...parts, part(surface(crown()), shade(hair, 0.92))];
}

function crown(): number[] {
  const positions: number[] = [];
  for (let column = 0; column < COLUMNS; column++)
    positions.push(...fadePoint(column, ROWS), 0, 0.352, -0.02, ...fadePoint(column + 1, ROWS));
  return positions;
}
