// Camp stations, each about one tile wide and facing +z.
import * as THREE from 'three';
import { ball, blob, cyl, lathe, merge, part, plate, rbox, shade, taper, torus } from '../geo';
import { type Geometry, ring, TAU } from './model';

const STONE = '#918d85';
const WOOD = '#8a6b48';
const IRON = '#5d6369';

/** Rows of stone blocks laid in a circle. */
const stones = (rows: number, rad: number, n: number, y0 = 0.12, sh = 1) =>
  Array.from({ length: rows }).flatMap((_, r) =>
    ring(n).map((a, i) =>
      part(
        rbox(0.36, 0.23, 0.22, 0.06),
        shade(STONE, (0.9 + ((i * 3 + r) % 4) * 0.05) * sh),
        [Math.cos(a + r * 0.35) * rad, y0 + r * 0.24, Math.sin(a + r * 0.35) * rad],
        [0, Math.PI / 2 - (a + r * 0.35), 0],
      ),
    ),
  );

const bank = () =>
  merge([
    part(rbox(0.95, 0.48, 0.64), WOOD, [0, 0.28, 0]),
    part(
      new THREE.CylinderGeometry(0.32, 0.32, 0.95, 6, 1, false, 0, Math.PI),
      shade(WOOD, 1.12),
      [0, 0.52, 0],
      [0, Math.PI / 2, Math.PI / 2],
    ),
    ...[-0.36, 0, 0.36].flatMap(x => [
      part(torus(0.325, 0.025, Math.PI), '#b99a5a', [x, 0.52, 0], [0, Math.PI / 2, 0]),
      part(rbox(0.06, 0.48, 0.67, 0.01), '#b99a5a', [x, 0.28, 0]),
    ]),
    part(rbox(0.16, 0.2, 0.05, 0.02), '#d8bd7e', [0, 0.5, 0.33]),
    part(cyl(0.025, 0.025, 0.04), '#4a4034', [0, 0.49, 0.36], [Math.PI / 2, 0, 0]),
  ]);

const furnace = () =>
  merge([
    part(cyl(0.44, 0.48, 1), shade(STONE, 0.75), [0, 0.5, 0]),
    ...stones(4, 0.42, 6),
    ...stones(2, 0.32, 5, 1.08),
    part(
      lathe(
        [
          [0.42, 1],
          [0.36, 1.3],
          [0.22, 1.6],
          [0.2, 2.1],
        ],
        8,
      ),
      shade(STONE, 0.82),
    ),
    part(torus(0.21, 0.05), shade(STONE, 0.7), [0, 2.1, 0], [Math.PI / 2, 0, 0]),
    part(
      new THREE.SphereGeometry(0.22, 8, 4, 0, TAU, 0, Math.PI / 2),
      '#2c2624',
      [0, 0.24, 0.46],
      [0, 0, 0],
      [1, 1.25, 0.5],
    ),
    part(blob(0.14, 0.3, 2), '#f0a050', [0, 0.3, 0.55], [0, 0, 0], [1.1, 0.8, 0.5]),
    part(blob(0.09, 0.3, 4), '#f7d27a', [0.02, 0.28, 0.62]),
    part(torus(0.25, 0.05, Math.PI), shade(STONE, 1.1), [0, 0.28, 0.54]),
  ]);

const anvil = () =>
  merge([
    part(
      lathe(
        [
          [0.33, 0],
          [0.3, 0.1],
          [0.27, 0.35],
          [0.28, 0.45],
        ],
        8,
      ),
      WOOD,
    ),
    part(torus(0.3, 0.02), IRON, [0, 0.14, 0], [Math.PI / 2, 0, 0]),
    part(
      lathe(
        [
          [0.26, 0],
          [0.15, 0.09],
          [0.13, 0.15],
          [0.22, 0.22],
        ],
        8,
      ),
      IRON,
      [0, 0.45, 0],
      [0, 0, 0],
      [1.2, 1, 0.8],
    ),
    part(rbox(0.62, 0.16, 0.3, 0.03), shade(IRON, 1.15), [0, 0.74, 0]),
    part(
      taper(
        [
          [0.28, 0.75, 0],
          [0.45, 0.75, 0],
          [0.62, 0.79, 0],
        ],
        0.1,
        0.015,
      ),
      shade(IRON, 1.15),
    ),
  ]);

const workbench = () =>
  merge([
    ...[-0.28, 0, 0.28].map((z, i) =>
      part(rbox(1.05, 0.09, 0.26, 0.02), shade(WOOD, 1 + i * 0.05), [0, 0.7, z]),
    ),
    ...(
      [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const
    ).map(([x, z]) => part(cyl(0.06, 0.07, 0.66), shade(WOOD, 0.8), [x * 0.42, 0.33, z * 0.3])),
    part(rbox(0.86, 0.07, 0.07, 0.02), shade(WOOD, 0.75), [0, 0.22, 0.3]),
    part(rbox(0.86, 0.07, 0.07, 0.02), shade(WOOD, 0.75), [0, 0.22, -0.3]),
    part(rbox(0.34, 0.03, 0.26, 0.01), '#d6c69a', [-0.24, 0.76, 0.08], [0, 0.3, 0]),
    part(cyl(0.02, 0.025, 0.34), '#7a5f42', [0.2, 0.78, 0.02], [0, 0.4, Math.PI / 2]),
    part(rbox(0.09, 0.09, 0.2, 0.02), IRON, [0.34, 0.8, -0.04], [0, 0.4, 0]),
    part(
      lathe(
        [
          [0.07, 0],
          [0.09, 0.1],
          [0.06, 0.18],
        ],
        8,
      ),
      '#a8685a',
      [0.1, 0.74, -0.28],
    ),
  ]);

const reaper = () =>
  merge([
    part(
      lathe([
        [0.5, 0],
        [0.4, 0.2],
        [0.3, 0.75],
        [0.27, 1.15],
        [0.12, 1.4],
      ]),
      '#3d414a',
    ),
    part(
      new THREE.SphereGeometry(0.27, 8, 4, Math.PI * 0.75, Math.PI * 1.5, 0, 2.2),
      '#454a54',
      [0, 1.47, 0],
    ),
    part(torus(0.19, 0.04), '#4d525d', [0, 1.45, 0.17], [0, 0, 0], [1, 1.2, 1]),
    part(ball(0.2), '#1f2126', [0, 1.46, 0]),
    part(ball(0.145), '#e3dccb', [0, 1.46, 0.13], [0, 0, 0], [0.9, 1.1, 0.8]),
    part(rbox(0.12, 0.09, 0.1, 0.03), '#d6cfbf', [0, 1.33, 0.16]),
    part(ball(0.038), '#24262a', [0.055, 1.48, 0.225]),
    part(ball(0.038), '#24262a', [-0.055, 1.48, 0.225]),
    part(ball(0.016), '#24262a', [0, 1.42, 0.25]),
    part(
      taper(
        [
          [0.2, 1.15, 0],
          [0.4, 0.98, 0.14],
          [0.5, 1, 0.24],
        ],
        0.12,
        0.09,
      ),
      '#3a3e47',
    ),
    part(ball(0.055), '#d6cfbf', [0.52, 1, 0.26]),
    part(
      taper(
        [
          [0.54, 0, 0.26],
          [0.52, 1, 0.26],
          [0.55, 2, 0.26],
        ],
        0.03,
        0.025,
      ),
      '#74593c',
    ),
    part(
      plate(q => {
        q.moveTo(0, 0);
        q.quadraticCurveTo(-0.5, 0.2, -0.85, -0.28);
        q.quadraticCurveTo(-0.5, 0.02, 0, -0.1);
        q.closePath();
      }, 0.02),
      '#b4babf',
      [0.56, 1.92, 0.26],
    ),
  ]);

const dock = () =>
  merge([
    part(cyl(0.07, 0.09, 1.6), WOOD, [0, 0.8, 0]),
    ...[0, 1].map(i =>
      part(rbox(0.85, 0.2, 0.07, 0.02), shade(WOOD, 1.2 - i * 0.08), [0, 1.36 - i * 0.22, 0.09]),
    ),
    part(torus(0.11, 0.02), IRON, [0, 1.25, 0.15]),
    part(rbox(0.02, 0.22, 0.02, 0.005), IRON, [0, 1.25, 0.15]),
    part(torus(0.12, 0.035), '#c9b98e', [0, 0.3, 0], [Math.PI / 2, 0, 0]),
    part(torus(0.12, 0.035), '#bfae82', [0, 0.36, 0], [Math.PI / 2, 0.1, 0]),
  ]);

const SHAPES: Record<string, () => Geometry> = { bank, furnace, anvil, workbench, reaper, dock };

export const stationGeo = (type: string): Geometry => SHAPES[type]();
