// Capes: a sheet hanging from the shoulders, with a collar and a clasp.
import type { Item } from '@driftwake/shared';
import * as THREE from 'three';
import { blob, gem, loft, merge, part, shade } from '../../geo';
import { type Geometry, pivot } from '../model';
import { SHOULDER } from './plan';

const GOLD = '#d9b25b';
const LENGTH = 0.92;
const COLUMNS = 8;
const ROWS = 6;
const LEAVES = 11;

/** The cloth swings; the collar stays where it is. */
export function capeParts({ id, color }: Item): { cloth: THREE.Group; collar: THREE.Group } {
  const isMantle = id === 'rooted_mantle';
  const parts = [part(sheet(), color), ...(isMantle ? leaves(color) : border(color))];
  const ring = loft(
    [
      [0.47, 0.13, 0.1, -0.014],
      [0.53, 0.1, 0.092, -0.016],
      [0.56, 0.112, 0.1, -0.022],
    ],
    10,
  );
  const clasp = part(gem(0.028), isMantle ? '#c9d66a' : GOLD, [0, 0.47, 0.105]);
  return {
    cloth: pivot(merge(parts), 0, SHOULDER + 0.02, -0.1),
    collar: pivot(merge([part(ring, shade(color, 0.85)), clasp]), 0, 0),
  };
}

/** Wider and wavier towards the hem, curving round the back. Two sided, so it can be seen from the front. */
function point(column: number, row: number, depth: number): [number, number, number] {
  const across = column / COLUMNS - 0.5;
  const down = row / ROWS;
  const width = 0.3 + down * 0.22;
  const fold = Math.cos(across * Math.PI * 5) * 0.02 * down;
  return [across * width, -down * LENGTH, -0.02 - down * 0.05 + across * across * 0.22 - fold + depth];
}

function sheet(): Geometry {
  const positions: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) =>
    positions.push(...a, ...b, ...c, ...c, ...b, ...d);
  for (const [depth, flip] of [
    [0, false],
    [0.012, true],
  ] as const)
    for (let row = 0; row < ROWS; row++)
      for (let column = 0; column < COLUMNS; column++) {
        const [left, right] = flip ? [column + 1, column] : [column, column + 1];
        quad(
          point(right, row, depth),
          point(right, row + 1, depth),
          point(left, row, depth),
          point(left, row + 1, depth),
        );
      }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

const hemPoints = (count: number, row: number) =>
  Array.from({ length: count }, (_, i) => point((i / (count - 1)) * COLUMNS, row, -0.012));

const border = (color: string): Geometry[] => [
  ...hemPoints(9, ROWS).map(([x, y, z]) =>
    part(blob(0.036, 0.1, 1), GOLD, [x, y + 0.02, z], [0, 0, 0], [1, 0.7, 0.4]),
  ),
  part(gem(0.075), shade(color, 1.35), [0, -0.42, -0.075], [0, 0, 0], [1, 1.3, 0.3]),
];

const leaves = (color: string): Geometry[] =>
  [1.6, 3.2, 4.8, ROWS].flatMap((row, r) =>
    hemPoints(LEAVES - 3 + r, row).map(([x, y, z], i) =>
      part(
        blob(0.06, 0.15, i + r),
        shade(color, 0.8 + ((i + r) % 3) * 0.16),
        [x, y, z - 0.012],
        [0.3, 0, i],
        [0.8, 1.2, 0.35],
      ),
    ),
  );
