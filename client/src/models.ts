import {
  defaultLook,
  HAIR_COLORS,
  ITEMS,
  type Look,
  MONSTERS,
  NODES,
  nameHash,
  WOOD_COLORS,
} from '@magicka/shared';
import * as THREE from 'three';
import {
  ball,
  bend,
  blob,
  capsule,
  cone,
  crystal,
  cyl,
  gem,
  lathe,
  loft,
  MAT,
  merge,
  part,
  plate,
  type Ring,
  rbox,
  sculpt,
  shade,
  taper,
  torus,
  type V3,
} from './geo';
import { fade, HEAD, haircut } from './hair';

type G = THREE.BufferGeometry;
const TAU = Math.PI * 2,
  ring = (n: number) => Array.from({ length: n }, (_, i) => (i / n) * TAU);
const LEAF = ['', '#9cc463', '#4c8f76', '#6aa356', '#dd8350', '#6b64a0'];
// --- resources
export function nodeGeo(type: string): { full: G; spent: G; h: number } {
  const d = NODES[type],
    c = d.color;
  if (d.kind === 'tree') {
    const w = WOOD_COLORS[d.tier],
      l = LEAF[d.tier];
    const roots = ring(5).map((a, i) =>
      part(
        taper(
          [
            [Math.cos(a) * 0.1, 0.24, Math.sin(a) * 0.1],
            [Math.cos(a) * 0.26, 0.09, Math.sin(a) * 0.26],
            [Math.cos(a) * (0.42 + (i % 2) * 0.08), -0.02, Math.sin(a) * 0.44],
          ],
          0.1,
          0.03,
          8,
          7,
        ),
        shade(w, 0.85),
      ),
    );
    const stump = [
      part(
        lathe([
          [0.31, 0],
          [0.24, 0.12],
          [0.21, 0.36],
        ]),
        w,
      ),
      part(cyl(0.21, 0.21, 0.03, 20), shade(w, 1.45), [0, 0.37, 0]),
      part(torus(0.12, 0.008), shade(w, 1.1), [0, 0.39, 0], [Math.PI / 2, 0, 0]),
      ...roots,
    ];
    const trunk = [
      part(
        lathe(
          [
            [0.31, 0],
            [0.21, 0.18],
            [0.17, 0.6],
            [0.14, 1.2],
            [0.09, 1.9],
            [0.05, 2.3],
          ],
          14,
        ),
        w,
      ),
      ...roots,
    ];
    if (d.tier === 2) {
      const tiers = [0, 1, 2, 3, 4].map(i => {
        const r = 0.92 - i * 0.16,
          y = 0.95 + i * 0.46,
          g = lathe(
            [
              [0.02, 0.75],
              [r * 0.4, 0.4],
              [r * 0.82, 0.08],
              [r, 0],
              [r * 0.6, 0.06],
              [0.06, 0.12],
            ],
            22,
          ),
          p = g.attributes.position;
        for (let k = 0; k < p.count; k++) {
          const x = p.getX(k),
            z = p.getZ(k),
            q = Math.hypot(x, z) / r,
            f = 1 + 0.09 * q * Math.sin(Math.atan2(z, x) * 4 + i);
          p.setXYZ(k, x * f, p.getY(k) - 0.07 * q * Math.sin(Math.atan2(z, x) * 4 + i), z * f);
        }
        g.computeVertexNormals();
        return part(g, shade(l, 0.88 + i * 0.06), [0, y, 0], [0, i, 0]);
      });
      return { full: bend(merge([...trunk, ...tiers]), 0.16), spent: merge(stump), h: 3.3 };
    }
    const spread = d.tier === 4 ? 1.1 : 1,
      limbs = ring(4).map((a, i) =>
        part(
          taper(
            [
              [0, 1 + i * 0.12, 0],
              [Math.cos(a) * 0.3, 1.45 + i * 0.1, Math.sin(a) * 0.3],
              [Math.cos(a) * 0.55, 1.85, Math.sin(a) * 0.55],
            ],
            0.08,
            0.03,
            8,
            7,
          ),
          w,
        ),
      );
    const crown = [
      part(blob(0.82, 4, 0.14, d.tier), l, [0, 2.2, 0], [0, 0, 0], [1.3 * spread, 0.62, 1.3 * spread]),
      part(
        blob(0.66, 4, 0.14, d.tier + 3),
        shade(l, 1.1),
        [0.16, 2.75, 0.05],
        [0, 0, 0],
        [1.1 * spread, 0.6, 1.1 * spread],
      ),
      ...ring(3).map((a, i) =>
        part(
          blob(0.4, 3, 0.16, i + d.tier),
          shade(l, 0.92),
          [Math.cos(a) * 0.82 * spread, 1.82 + i * 0.1, Math.sin(a) * 0.82 * spread],
          [0, 0, 0],
          [1.2, 0.6, 1.2],
        ),
      ),
      part(blob(0.4, 3, 0.14, 9), shade(l, 1.2), [0.02, 3.15, 0], [0, 0, 0], [1.1, 0.65, 1.1]),
    ];
    return { full: bend(merge([...trunk, ...limbs, ...crown]), 0.22), spent: merge(stump), h: 3.1 };
  }
  if (d.kind === 'rock') {
    const base = type === 'essence_rock' ? '#7b7f92' : '#938d8c';
    const rock = [
      part(blob(0.47, 4, 0.2, 2 + d.tier, true), base, [0, 0.36, 0], [0, d.tier, 0.12], [0.95, 1.2, 0.9]),
      part(blob(0.32, 3, 0.2, 7, true), shade(base, 0.9), [0.3, 0.2, 0.18], [0, 0, -0.35], [0.8, 1.25, 0.8]),
      part(blob(0.2, 3, 0.26, 4, true), shade(base, 1.06), [-0.34, 0.08, 0.24]),
      part(blob(0.12, 2, 0.2, 1, true), shade(base, 0.95), [-0.1, 0.04, 0.46]),
    ];
    const vein =
      type === 'essence_rock'
        ? ring(6).map((a, i) =>
            part(
              crystal(0.075 + (i % 2) * 0.03, 0.5 + (i % 3) * 0.16),
              shade(c, 0.95 + (i % 3) * 0.1),
              [Math.cos(a) * 0.22, 0.62, Math.sin(a) * 0.22],
              [Math.sin(a) * 0.45, i, -Math.cos(a) * 0.45],
            ),
          )
        : ring(9).map((a, i) => {
            const up = [0.2, 0.48, 0.74][i % 3],
              r = [0.45, 0.42, 0.28][i % 3];
            return part(
              gem(0.14 + (i % 2) * 0.05),
              shade(c, 0.95 + (i % 3) * 0.13),
              [Math.cos(a) * r, up, Math.sin(a) * r],
              [a, i, 0],
              [1, 0.75, 1],
            );
          });
    return { full: merge([...rock, ...vein]), spent: merge(rock), h: 0.95 };
  }
  if (type === 'berry_bush') {
    const bush = [
      part(blob(0.38, 4, 0.2, 1), '#5f8050', [0, 0.34, 0]),
      ...ring(5).map((a, i) =>
        part(blob(0.22, 3, 0.2, i), shade('#678a55', 0.92 + (i % 3) * 0.08), [
          Math.cos(a) * 0.28,
          0.24 + (i % 2) * 0.12,
          Math.sin(a) * 0.28,
        ]),
      ),
    ];
    return {
      full: merge([
        ...bush,
        ...ring(12).map((a, i) =>
          part(ball(0.055, 10), shade(c, 0.95 + (i % 2) * 0.2), [
            Math.cos(a) * 0.42,
            0.22 + (i % 4) * 0.11,
            Math.sin(a) * 0.42,
          ]),
        ),
      ]),
      spent: merge(bush),
      h: 0.8,
    };
  }
  const blades = ring(9).map((a, i) =>
    part(
      taper(
        [
          [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06],
          [Math.cos(a) * 0.12, 0.3, Math.sin(a) * 0.12],
          [Math.cos(a) * 0.32, 0.42 + (i % 3) * 0.08, Math.sin(a) * 0.32],
        ],
        0.032,
        0.004,
        8,
        5,
      ),
      shade('#6f8a52', 0.9 + (i % 3) * 0.1),
    ),
  );
  const heads = ring(6).flatMap((a, i): G[] => {
    const x = Math.cos(a) * 0.2,
      z = Math.sin(a) * 0.2,
      y = 0.58 + (i % 2) * 0.12;
    return [
      part(
        taper(
          [
            [x * 0.2, 0, z * 0.2],
            [x * 0.7, 0.3, z * 0.7],
            [x, y, z],
          ],
          0.014,
          0.01,
          8,
          5,
        ),
        '#7d9660',
      ),
      part(ball(0.045, 8), shade(c, 0.75), [x, y, z]),
      ...ring(5).map(b =>
        part(ball(0.05, 8), c, [x + Math.cos(b) * 0.07, y, z + Math.sin(b) * 0.07], [0, 0, 0], [1, 0.5, 1]),
      ),
    ];
  });
  return { full: merge([...blades, ...heads]), spent: merge(blades), h: 0.8 };
}
// --- camp
export function stationGeo(type: string): G {
  const s = '#918d85',
    w = '#8a6b48',
    iron = '#5d6369';
  const stones = (rows: number, rad: number, n: number, y0 = 0.12, sh = 1) =>
    Array.from({ length: rows }).flatMap((_, r) =>
      ring(n).map((a, i) =>
        part(
          rbox(0.36, 0.23, 0.22, 0.06),
          shade(s, (0.9 + ((i * 3 + r) % 4) * 0.05) * sh),
          [Math.cos(a + r * 0.35) * rad, y0 + r * 0.24, Math.sin(a + r * 0.35) * rad],
          [0, Math.PI / 2 - (a + r * 0.35), 0],
        ),
      ),
    );
  switch (type) {
    case 'bank':
      return merge([
        part(rbox(0.95, 0.48, 0.64), w, [0, 0.28, 0]),
        part(
          new THREE.CylinderGeometry(0.32, 0.32, 0.95, 6, 1, false, 0, Math.PI),
          shade(w, 1.12),
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
    case 'furnace':
      return merge([
        part(cyl(0.44, 0.48, 1), shade(s, 0.75), [0, 0.5, 0]),
        ...stones(4, 0.42, 6),
        ...stones(2, 0.32, 5, 1.08),
        part(
          lathe([
            [0.42, 1],
            [0.36, 1.3],
            [0.22, 1.6],
            [0.2, 2.1],
          ]),
          shade(s, 0.82),
        ),
        part(torus(0.21, 0.05), shade(s, 0.7), [0, 2.1, 0], [Math.PI / 2, 0, 0]),
        part(
          new THREE.SphereGeometry(0.22, 8, 4, 0, TAU, 0, Math.PI / 2),
          '#2c2624',
          [0, 0.24, 0.46],
          [0, 0, 0],
          [1, 1.25, 0.5],
        ),
        part(blob(0.14, 3, 0.3, 2), '#f0a050', [0, 0.3, 0.55], [0, 0, 0], [1.1, 0.8, 0.5]),
        part(blob(0.09, 2, 0.3, 4), '#f7d27a', [0.02, 0.28, 0.62]),
        part(torus(0.25, 0.05, Math.PI), shade(s, 1.1), [0, 0.28, 0.54]),
      ]);
    case 'anvil':
      return merge([
        part(
          lathe([
            [0.33, 0],
            [0.3, 0.1],
            [0.27, 0.35],
            [0.28, 0.45],
          ]),
          w,
        ),
        part(torus(0.3, 0.02), iron, [0, 0.14, 0], [Math.PI / 2, 0, 0]),
        part(
          lathe([
            [0.26, 0],
            [0.15, 0.09],
            [0.13, 0.15],
            [0.22, 0.22],
          ]),
          iron,
          [0, 0.45, 0],
          [0, 0, 0],
          [1.2, 1, 0.8],
        ),
        part(rbox(0.62, 0.16, 0.3, 0.03), shade(iron, 1.15), [0, 0.74, 0]),
        part(
          taper(
            [
              [0.28, 0.75, 0],
              [0.45, 0.75, 0],
              [0.62, 0.79, 0],
            ],
            0.1,
            0.015,
            8,
            12,
          ),
          shade(iron, 1.15),
        ),
      ]);
    case 'workbench':
      return merge([
        ...[-0.28, 0, 0.28].map((z, i) =>
          part(rbox(1.05, 0.09, 0.26, 0.02), shade(w, 1 + i * 0.05), [0, 0.7, z]),
        ),
        ...(
          [
            [-1, -1],
            [1, -1],
            [-1, 1],
            [1, 1],
          ] as const
        ).map(([x, z]) => part(cyl(0.06, 0.07, 0.66), shade(w, 0.8), [x * 0.42, 0.33, z * 0.3])),
        part(rbox(0.86, 0.07, 0.07, 0.02), shade(w, 0.75), [0, 0.22, 0.3]),
        part(rbox(0.86, 0.07, 0.07, 0.02), shade(w, 0.75), [0, 0.22, -0.3]),
        part(rbox(0.34, 0.03, 0.26, 0.01), '#d6c69a', [-0.24, 0.76, 0.08], [0, 0.3, 0]),
        part(cyl(0.02, 0.025, 0.34), '#7a5f42', [0.2, 0.78, 0.02], [0, 0.4, Math.PI / 2]),
        part(rbox(0.09, 0.09, 0.2, 0.02), iron, [0.34, 0.8, -0.04], [0, 0.4, 0]),
        part(
          lathe([
            [0.07, 0],
            [0.09, 0.1],
            [0.06, 0.18],
          ]),
          '#a8685a',
          [0.1, 0.74, -0.28],
        ),
      ]);
    case 'reaper':
      return merge([
        part(
          lathe(
            [
              [0.5, 0],
              [0.4, 0.2],
              [0.3, 0.75],
              [0.27, 1.15],
              [0.12, 1.4],
            ],
            22,
          ),
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
        part(ball(0.038, 10), '#24262a', [0.055, 1.48, 0.225]),
        part(ball(0.038, 10), '#24262a', [-0.055, 1.48, 0.225]),
        part(ball(0.016, 8), '#24262a', [0, 1.42, 0.25]),
        part(
          taper(
            [
              [0.2, 1.15, 0],
              [0.4, 0.98, 0.14],
              [0.5, 1, 0.24],
            ],
            0.12,
            0.09,
            10,
            12,
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
            12,
            8,
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
    default:
      return merge([
        part(cyl(0.07, 0.09, 1.6), w, [0, 0.8, 0]),
        ...[0, 1].map(i =>
          part(rbox(0.85, 0.2, 0.07, 0.02), shade(w, 1.2 - i * 0.08), [0, 1.36 - i * 0.22, 0.09]),
        ),
        part(torus(0.11, 0.02), iron, [0, 1.25, 0.15]),
        part(rbox(0.02, 0.22, 0.02, 0.005), iron, [0, 1.25, 0.15]),
        part(torus(0.12, 0.035), '#c9b98e', [0, 0.3, 0], [Math.PI / 2, 0, 0]),
        part(torus(0.12, 0.035), '#bfae82', [0, 0.36, 0], [Math.PI / 2, 0.1, 0]),
      ]);
  }
}
export function boatGeo(done: (p: string) => number): G {
  const w = '#b08a5a',
    hull = done('hull'),
    l: G[] = [
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
          18,
          8,
        ),
        shade(w, 0.65),
      ),
    ];
  const side = (x: number, row: number): V3[] => [
    [0, 0.1 + row * 0.1, -1.62 - row * 0.06],
    [x * (0.36 + row * 0.07), -0.02 + row * 0.12, -0.9],
    [x * (0.5 + row * 0.07), -0.06 + row * 0.12, 0.2],
    [x * (0.4 + row * 0.07), -0.02 + row * 0.12, 1.4],
  ];
  const rows = Math.floor(hull * 4);
  for (let r = 0; r < rows; r++)
    for (const x of [-1, 1])
      l.push(part(taper(side(x, r), 0.075, 0.075, 24, 8), shade(w, 0.92 + (r % 2) * 0.1)));
  if (hull > 0.2) l.push(part(rbox(0.7, 0.06, 2 * hull, 0.02), shade(w, 0.85), [0, -0.02, 0.1]));
  if (hull >= 1)
    l.push(
      part(rbox(0.8, 0.4, 0.08, 0.03), shade(w, 0.9), [0, 0.15, 1.38]),
      ...[-0.5, 0.5].map(z => part(rbox(1.05, 0.06, 0.24, 0.02), shade(w, 1.15), [0, 0.28, z])),
    );
  if (done('fittings') >= 1)
    l.push(
      ...[-0.9, 0, 0.9].flatMap(z => [-1, 1].map(x => part(ball(0.055), '#c98554', [x * 0.62, 0.38, z]))),
      part(torus(0.1, 0.025), '#c98554', [0, 0.35, -1.6]),
    );
  if (done('sail') > 0) {
    const k = done('sail'),
      g = new THREE.PlaneGeometry(1.35, 1.4 * k, 12, 12),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setZ(i, 0.22 * (1 - (p.getX(i) / 0.7) ** 2) * (1 - (p.getY(i) / (0.75 * k)) ** 2));
    g.computeVertexNormals();
    const b = g.clone();
    b.rotateY(Math.PI);
    const q = b.attributes.position;
    for (let i = 0; i < q.count; i++) q.setZ(i, -q.getZ(i) - 0.012);
    b.computeVertexNormals();
    l.push(
      part(cyl(0.04, 0.06, 2.5), shade(w, 0.8), [0, 1.2, -0.1]),
      part(cyl(0.03, 0.03, 1.5), shade(w, 0.8), [0, 2.25, -0.04], [0, 0, Math.PI / 2]),
      part(g, '#e6dec6', [0, 2.2 - 0.7 * k, 0]),
      part(b, '#d8cfb4', [0, 2.2 - 0.7 * k, 0]),
    );
  }
  if (done('rudder') >= 1)
    l.push(
      part(
        plate(q => {
          q.moveTo(0, 0.5);
          q.lineTo(0.1, 0.5);
          q.lineTo(0.34, -0.15);
          q.quadraticCurveTo(0.2, -0.35, 0, -0.3);
          q.closePath();
        }, 0.06),
        shade(w, 0.75),
        [0, 0.05, 1.45],
        [0, -Math.PI / 2, 0],
      ),
    );
  return merge(l);
}
// --- held items. The grip is at the origin, the shaft runs along +y and the working edge faces +z.
const SIDE: V3 = [0, -Math.PI / 2, 0];
export function heldGeo(icon: string, c: string, unique = false): G {
  const w = '#7d6144',
    wrap = '#5a4632',
    haft = (len: number) => [
      part(
        taper(
          [
            [0, -0.16, 0],
            [0, len * 0.4, 0.012],
            [0, len, 0],
          ],
          0.03,
          0.026,
          12,
          10,
        ),
        w,
      ),
      part(cyl(0.034, 0.034, 0.16), wrap, [0, 0, 0]),
      part(ball(0.036, 10), shade(w, 0.8), [0, -0.16, 0]),
    ];
  switch (icon) {
    case 'pickaxe':
      return merge([
        ...haft(0.66),
        part(rbox(0.085, 0.13, 0.11, 0.02), shade(c, 0.8), [0, 0.62, 0]),
        part(
          plate(s => {
            s.moveTo(0, 0.07);
            s.quadraticCurveTo(0.22, 0.06, 0.4, -0.1);
            s.quadraticCurveTo(0.2, 0, 0, -0.03);
            s.quadraticCurveTo(-0.2, 0, -0.34, -0.06);
            s.lineTo(-0.36, -0.02);
            s.quadraticCurveTo(-0.2, 0.07, 0, 0.07);
          }, 0.035),
          c,
          [0, 0.63, 0],
          SIDE,
        ),
      ]);
    case 'axe':
      return merge([
        ...haft(0.68),
        part(rbox(0.08, 0.15, 0.1, 0.02), shade(c, 0.8), [0, 0.6, 0]),
        part(
          plate(s => {
            s.moveTo(-0.07, 0.05);
            s.lineTo(0.06, 0.06);
            s.quadraticCurveTo(0.14, 0.08, 0.2, 0.19);
            s.quadraticCurveTo(0.3, 0, 0.2, -0.2);
            s.quadraticCurveTo(0.14, -0.08, 0.06, -0.06);
            s.lineTo(-0.07, -0.05);
            s.closePath();
          }, 0.03),
          c,
          [0, 0.6, 0.02],
          SIDE,
        ),
      ]);
    case 'hammer':
      return merge([
        ...haft(0.4),
        part(rbox(0.13, 0.14, 0.26, 0.025), c, [0, 0.42, 0]),
        part(rbox(0.145, 0.155, 0.05, 0.015), shade(c, 1.15), [0, 0.42, 0.12]),
      ]);
    case 'sword':
      return merge([
        part(cyl(0.028, 0.026, 0.2), wrap, [0, 0, 0]),
        part(ball(0.045), shade(c, 0.8), [0, -0.13, 0]),
        part(
          taper(
            [
              [0, 0.13, -0.17],
              [0, 0.11, 0],
              [0, 0.13, 0.17],
            ],
            0.028,
            0.028,
            12,
            10,
          ),
          shade(c, 0.75),
        ),
        part(
          plate(
            s => {
              const k = unique ? 0.085 : 0.055,
                h = unique ? 1 : 0.86;
              s.moveTo(-k, 0);
              s.quadraticCurveTo(-k * 0.75, h * 0.5, -k * 0.9, h * 0.82);
              s.lineTo(0, h);
              s.lineTo(k * 0.9, h * 0.82);
              s.quadraticCurveTo(k * 0.75, h * 0.5, k, 0);
              s.closePath();
            },
            0.016,
            0.012,
          ),
          c,
          [0, 0.12, 0],
          SIDE,
        ),
        part(rbox(0.045, 0.6, 0.02, 0.01), shade(c, 0.82), [0, 0.45, 0]),
      ]);
    case 'bow':
      return merge([
        part(
          taper(
            [
              [0, 0, 0.12],
              [0, 0.22, 0.1],
              [0, 0.44, -0.04],
              [0, 0.56, -0.02],
            ],
            0.034,
            0.014,
            18,
            10,
          ),
          c,
        ),
        part(
          taper(
            [
              [0, 0, 0.12],
              [0, -0.22, 0.1],
              [0, -0.44, -0.04],
              [0, -0.56, -0.02],
            ],
            0.034,
            0.014,
            18,
            10,
          ),
          c,
        ),
        part(cyl(0.04, 0.04, 0.2), wrap, [0, 0, 0.12]),
        part(cyl(0.005, 0.005, 1.1, 6), '#e4dcc8', [0, 0, -0.025]),
        ...(unique
          ? [0.3, -0.3].map(y => part(cone(0.03, 0.12), shade(c, 1.2), [0, y, 0.1], [1.3, 0, 0]))
          : []),
      ]);
    case 'staff':
      return merge([
        part(
          taper(
            [
              [0.01, -0.62, 0],
              [-0.015, -0.1, 0.01],
              [0.015, 0.4, 0],
              [0, 0.78, 0],
            ],
            0.03,
            0.04,
            20,
            10,
          ),
          c,
        ),
        part(cyl(0.042, 0.042, 0.16), wrap),
        ...ring(3).map(a =>
          part(
            taper(
              [
                [0, 0.74, 0],
                [Math.cos(a) * 0.13, 0.86, Math.sin(a) * 0.13],
                [Math.cos(a) * 0.05, 1.06, Math.sin(a) * 0.05],
              ],
              0.03,
              0.01,
              10,
              8,
            ),
            shade(c, 0.9),
          ),
        ),
        part(gem(0.1), unique ? '#b7e07a' : '#93c4e6', [0, 0.92, 0], [0, 0.3, 0], [1, 1.3, 1]),
      ]);
  }
  return part(rbox(0.1, 0.1, 0.1), c);
}
// --- characters
export interface Model {
  root: THREE.Group;
  parts: Record<string, THREE.Object3D>;
  h: number;
  kind: string;
  gear?: string;
}
export const mesh = (g: G) => {
  const m = new THREE.Mesh(g, MAT);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};
const pivot = (g: G | null, x: number, y: number, z = 0) => {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  if (g) p.add(mesh(g));
  return p;
};
// Body plan in metres at rest: hip 0.92, shoulder 1.36, crown about 1.8.
const LEG = 1.07,
  HIP = 0.86 * LEG,
  SHOULDER = 0.47;
const grow = (r: Ring[], k: number, from = 0, to = r.length): Ring[] =>
  r.slice(from, to).map(([y, x, z, oz, ox]) => [y, x + k, z + k, oz, ox]);
const TORSO: Ring[] = [
  [-0.05, 0.07, 0.04],
  [0.0, 0.11, 0.075, -0.004],
  [0.08, 0.135, 0.092],
  [0.16, 0.128, 0.086, 0.004],
  [0.24, 0.137, 0.09, 0.005],
  [0.29, 0.149, 0.096, 0.006],
  [0.335, 0.163, 0.108, 0.01],
  [0.4, 0.176, 0.108, 0.004],
  [0.455, 0.168, 0.084, -0.008],
  [0.5, 0.115, 0.07, -0.014],
  [0.54, 0.06, 0.056, -0.012],
];
/** Uneven facets, the same on every model. */
const chip = (amt: number) => (a: number, i: number) =>
  1 + amt * Math.sin(a * 5.3 + i * 4.1) * Math.sin(a * 2.7 - i * 1.9);
/** Chest shelf, breastbone, ribs, shoulder blades and spine. */
const torsoShape = (a: number, i: number) => {
  const f = Math.sin(a),
    side = Math.abs(Math.cos(a)),
    k = chip(0.04)(a, i);
  if (f > 0.9) return k * (i === 6 || i === 7 ? 0.92 : i === 5 ? 0.96 : 1);
  if (f > 0.3 && side > 0.3) return k * (i === 6 ? 1.08 : i === 7 ? 1.05 : i === 5 ? 0.96 : 1);
  if (f < -0.9) return k * (i >= 3 && i <= 8 ? 0.84 : 1);
  if (f < -0.3) return k * (i === 7 || i === 8 ? 1.12 : 1);
  return k;
};
const UPPER_ARM: Ring[] = [
  [0.04, 0.03, 0.04, -0.004, -0.024],
  [0.02, 0.052, 0.056, 0, -0.008],
  [-0.04, 0.06, 0.06],
  [-0.11, 0.048, 0.054, 0.006],
  [-0.2, 0.047, 0.052, 0.006],
  [-0.285, 0.036, 0.04],
];
const FOREARM: Ring[] = [
  [0.02, 0.036, 0.04],
  [-0.05, 0.05, 0.047, 0.002],
  [-0.11, 0.045, 0.042],
  [-0.22, 0.027, 0.026],
];
const THIGH: Ring[] = [
  [0.07, 0.02, 0.02],
  [0.045, 0.066, 0.07],
  [-0.02, 0.088, 0.098],
  [-0.14, 0.085, 0.095, 0.006],
  [-0.29, 0.066, 0.074, 0.006],
  [-0.39, 0.054, 0.06, 0.006],
];
const SHIN: Ring[] = [
  [0.03, 0.053, 0.056, 0.006],
  [-0.03, 0.05, 0.056, 0.004],
  [-0.1, 0.063, 0.068, -0.016],
  [-0.17, 0.06, 0.066, -0.02],
  [-0.28, 0.039, 0.044, -0.008],
  [-0.38, 0.031, 0.036],
  [-0.42, 0.036, 0.044],
];
/** Relaxed hand with curled fingers. */
function handGeo(skin: string, s: number): G[] {
  return [
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
          4,
          5,
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
        4,
        5,
      ),
      skin,
    ),
  ];
}
/** Changes whenever a player's model has to be rebuilt. */
export const modelKey = (gear: (string | null)[], look: Look) => `${gear.join()}|${look.cut}|${look.color}`;
export function playerModel(name: string, gear: (string | null)[], look: Look = defaultLook(name)): Model {
  const h = nameHash(name),
    cut = look.cut,
    skin = ['#f5cbaa', '#e6b18a', '#b98260', '#865d46'][h % 4],
    hair: string = HAIR_COLORS[look.color].color,
    cloth = ['#c9c6c2', '#8fa3b5', '#b3a486', '#9aa88a', '#a893a5'][(h >> 4) % 5];
  const it = (i: number) => (gear[i] ? ITEMS[gear[i]!] : null),
    head = it(1),
    body = it(2),
    legs = it(3),
    bc = body?.color ?? skin,
    lc = legs?.color ?? cloth;
  const plateB = !!body?.id.endsWith('_plate'),
    robe = !!body?.id.startsWith('cloth_'),
    leather = !!body && !plateB && !robe;
  const plateL = !!legs?.id.endsWith('_greaves'),
    skirt = !!legs?.id.startsWith('cloth_'),
    chaps = !!legs && !plateL && !skirt,
    strap = '#6b4a32',
    lips = new THREE.Color(skin).lerp(new THREE.Color('#9c3f3a'), 0.4).getStyle();
  const parts: Model['parts'] = {},
    root = new THREE.Group(),
    upper = pivot(null, 0, HIP);
  parts.upper = upper;
  const t: G[] = [
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
  // The waist of the shorts or trousers hangs on the hips, so it stays with the legs when the torso swings.
  const hips = pivot(
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
        lc,
      ),
      part(
        loft(
          [
            [0.07, 0.158, 0.116],
            [0.1, 0.152, 0.11],
          ],
          16,
        ),
        legs ? strap : shade(lc, 0.88),
      ),
    ]),
    0,
    HIP,
  );
  parts.hips = hips;
  root.add(hips);
  if (body) t.push(part(sculpt(grow(TORSO, plateB ? 0.022 : 0.013, robe ? 1 : 2, 10), 16, torsoShape), bc));
  if (plateB)
    t.push(
      part(
        loft(
          [
            [0.18, 0.15, 0.118, 0.01],
            [0.33, 0.19, 0.145, 0.014],
            [0.43, 0.185, 0.125, 0.006],
          ],
          8,
        ),
        shade(bc, 1.1),
      ),
      part(
        loft(
          [
            [0.48, 0.1, 0.085, -0.01],
            [0.535, 0.085, 0.08, -0.008],
          ],
          8,
        ),
        shade(bc, 0.85),
      ),
      part(rbox(0.31, 0.05, 0.23, 0.02), strap, [0, 0.1, 0]),
    );
  if (leather)
    t.push(
      part(rbox(0.045, 0.52, 0.02), strap, [0, 0.27, 0.13], [0, 0, 0.6]),
      part(
        loft(
          [
            [0.48, 0.095, 0.08, -0.01],
            [0.535, 0.078, 0.075, -0.008],
          ],
          8,
        ),
        shade(bc, 0.8),
      ),
      part(rbox(0.32, 0.055, 0.24, 0.02), strap, [0, 0.07, 0]),
      part(rbox(0.09, 0.09, 0.07, 0.02), shade(strap, 1.2), [0.13, 0.03, 0.09]),
    );
  if (robe)
    t.push(
      part(
        loft(
          [
            [0.43, 0.135, 0.105],
            [0.51, 0.085, 0.08, -0.008],
            [0.545, 0.095, 0.09, -0.008],
          ],
          8,
        ),
        shade(bc, 0.8),
      ),
      part(rbox(0.05, 0.46, 0.02), shade(bc, 0.72), [0, 0.22, 0.125]),
      part(
        loft(
          [
            [0.07, 0.162, 0.118],
            [0.13, 0.152, 0.11],
          ],
          10,
        ),
        shade(bc, 0.62),
      ),
    );
  parts.body = pivot(merge(t), 0, 0);
  // Head
  const hd: G[] = [
    part(loft(HEAD, 8), skin),
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
    ...[-1, 1].flatMap(s => [
      part(rbox(0.02, 0.02, 0.012), '#2b2a2e', [s * 0.045, 0.187, 0.084], [-0.04, s * 0.45, 0]),
      ...(head?.id.endsWith('_helm')
        ? []
        : [
            part(
              rbox(0.05, 0.015, 0.02),
              shade(hair, 0.8),
              [s * 0.04, 0.232, 0.0935],
              [0, s * 0.22, s * 0.04],
            ),
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
  if (!head) {
    hd.push(...fade(skin, hair, [0.8, 0.95, 0.8, 1.05][cut]), ...haircut(cut, hair, h));
  } else if (head.id.endsWith('_helm'))
    hd.push(
      ...fade(skin, hair, 0.9),
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
        head.color,
      ),
      part(
        loft(
          [
            [0.23, 0.13, 0.138, -0.006],
            [0.258, 0.129, 0.138, -0.006],
          ],
          8,
        ),
        shade(head.color, 0.8),
      ),
      part(rbox(0.022, 0.1, 0.02), shade(head.color, 0.85), [0, 0.19, 0.14]),
      part(rbox(0.026, 0.06, 0.2, 0.01), shade(head.color, 1.15), [0, 0.365, -0.012]),
      ...[-1, 1].map(s =>
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
          head.color,
          [s * 0.122, 0.235, -0.005],
          [0, -Math.PI / 2, 0],
        ),
      ),
    );
  else
    hd.push(
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
        head.color,
      ),
      part(
        loft(
          [
            [0.25, 0.122, 0.132, 0.0],
            [0.285, 0.12, 0.13, 0.0],
          ],
          8,
        ),
        shade(head.color, 0.8),
      ),
      ...[-1, 1].map(s =>
        part(
          loft(
            [
              [0.02, 0.02, 0.04],
              [0.14, 0.018, 0.045],
              [0.25, 0.018, 0.03],
            ],
            5,
          ),
          shade(head.color, 0.88),
          [s * 0.112, 0, 0.04],
        ),
      ),
    );
  parts.head = pivot(merge(hd), 0, 0.515, 0.01);
  parts.head.scale.setScalar(1.04);
  // Arms
  const arm = (n: string, s: number) => {
    const up: G[] = [
        part(
          sculpt(
            UPPER_ARM.map(([y, x, z, oz, ox = 0]): Ring => [y, x, z, oz, ox * s]),
            11,
            chip(0.045),
          ),
          robe || leather ? shade(bc, 0.95) : skin,
        ),
      ],
      fo: G[] = [part(sculpt(FOREARM, 11, chip(0.045)), skin), ...handGeo(skin, s)];
    if (leather)
      up.push(
        part(
          loft(
            [
              [0.055, 0.04, 0.05],
              [0.025, 0.074, 0.08],
              [-0.05, 0.08, 0.082],
            ],
            7,
          ),
          shade(bc, 0.8),
          [s * 0.008, 0, 0],
        ),
      ),
        fo.push(part(sculpt(grow(FOREARM, 0.013, 1), 12), strap));
    if (plateB)
      up.push(
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
          shade(bc, 1.1),
          [s * 0.012, 0, 0],
        ),
        part(sculpt(grow(UPPER_ARM, 0.008, 3), 12), shade(bc, 0.75)),
      ),
        fo.push(part(sculpt(grow(FOREARM, 0.018, 0), 12), bc));
    if (robe)
      up.push(part(sculpt(grow(UPPER_ARM, 0.016), 12), bc)),
        fo.push(
          part(
            loft(
              [
                [0.03, 0.054, 0.056],
                [-0.08, 0.066, 0.07],
                [-0.19, 0.088, 0.096],
              ],
              8,
            ),
            bc,
          ),
          part(
            loft(
              [
                [-0.17, 0.089, 0.097],
                [-0.2, 0.091, 0.1],
              ],
              8,
            ),
            shade(bc, 0.75),
          ),
        );
    const a = pivot(merge(up), s * 0.183, SHOULDER - 0.035),
      f = pivot(merge(fo), 0, -0.275),
      hand = new THREE.Group();
    hand.position.set(0, -0.29, 0.02);
    f.add(hand);
    a.add(f);
    parts[n] = a;
    parts[n + '2'] = f;
    parts[n + 'h'] = hand;
    upper.add(a);
  };
  arm('la', 1);
  arm('ra', -1);
  upper.add(parts.body, parts.head);
  // Legs
  const leg = (n: string, s: number) => {
    const th: G[] = [part(sculpt(THIGH, 12, chip(0.045)), chaps || plateL ? shade(lc, 0.85) : skin)],
      sh: G[] = [part(sculpt(SHIN, 12, chip(0.045)), legs && !skirt ? shade(lc, 0.85) : skin)];
    // Loose shorts: wider at the hem, with uneven folds.
    if (!legs)
      th.push(
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
      );
    if (chaps)
      th.push(part(sculpt(grow(THIGH, 0.012), 12), lc)),
        sh.push(part(sculpt(grow(SHIN, 0.01, 0, 6), 12), lc));
    if (plateL)
      th.push(part(sculpt(grow(THIGH, 0.018, 2, 5), 12), lc)),
        sh.push(
          part(sculpt(grow(SHIN, 0.016, 1, 6), 12), lc),
          part(
            loft(
              [
                [0.05, 0.045, 0.045],
                [0, 0.07, 0.078],
                [-0.05, 0.045, 0.05],
              ],
              7,
            ),
            shade(lc, 1.12),
            [0, 0.01, 0.018],
          ),
        );
    const foot = (c: string, k: number) =>
      part(
        sculpt(
          [
            [-0.445, 0.048 + k, 0.115 + k, 0.045],
            [-0.42, 0.048 + k, 0.112 + k, 0.045],
            [-0.385, 0.04 + k, 0.07 + k, 0.018],
            [-0.34, 0.036 + k, 0.044 + k, 0],
          ],
          11,
        ),
        c,
      );
    sh.push(legs ? foot(strap, 0.012) : foot(skin, 0));
    if (legs)
      sh.push(
        part(
          loft(
            [
              [-0.35, 0.055, 0.062],
              [-0.22, 0.064, 0.07, -0.014],
              [-0.19, 0.074, 0.08, -0.016],
            ],
            8,
          ),
          strap,
        ),
      );
    else
      for (let i = 0; i < 4; i++)
        sh.push(
          part(rbox(0.019, 0.022, 0.035), skin, [
            (i - 1.5) * 0.021,
            -0.432,
            0.148 - Math.abs(i - (s > 0 ? 0.6 : 2.4)) * 0.008,
          ]),
        );
    const tall = (l: G[]) => merge(l).scale(1, LEG, 1),
      t2 = pivot(tall(th), s * 0.086, HIP),
      s2 = pivot(tall(sh), 0, -0.4 * LEG);
    t2.add(s2);
    parts[n] = t2;
    parts[n + '2'] = s2;
    root.add(t2);
  };
  leg('ll', 1);
  leg('rl', -1);
  if (skirt || robe)
    hips.add(
      pivot(
        part(
          loft(
            [
              [0.07, 0.156, 0.116],
              [-0.1, 0.188, 0.16],
              [-0.36, 0.25, 0.23],
              [-0.6, 0.29, 0.27],
            ],
            11,
            (a, i) => 1 + (i > 1 ? Math.sin(a * 5) * 0.06 : 0),
          ),
          skirt ? lc : shade(bc, 0.92),
        ),
        0,
        0,
      ),
    );
  root.add(upper);
  const wp = it(0);
  if (wp) {
    const g = mesh(heldGeo(wp.icon, wp.color, wp.unique));
    g.scale.setScalar(1.1);
    if (wp.icon === 'bow') {
      g.rotation.x = Math.PI / 2 - 0.05;
      parts.lah.add(g);
    } else {
      g.rotation.x = 1.5;
      parts.rah.add(g);
    }
    parts.weapon = g;
  }
  return { root, parts, h: 1.85, kind: 'p', gear: modelKey(gear, look) };
}
// --- monsters
const eyes = (x: number, y: number, z: number, r = 0.045, c = '#26231f'): G[] =>
  [-1, 1].flatMap(s => [
    part(ball(r, 10), c, [x * s, y, z]),
    part(ball(r * 0.35, 6), '#f5f0e4', [x * s + r * 0.3, y + r * 0.35, z + r * 0.8]),
  ]);
export function monsterModel(type: string): Model {
  const d = MONSTERS[type],
    c = d.color,
    dk = shade(c, 0.72),
    lt = shade(c, 1.2),
    root = new THREE.Group(),
    parts: Model['parts'] = {};
  let h = 1.1;
  if (d.shape === 'beast') {
    const pig = type === 'boar',
      deer = type === 'stag',
      drake = type === 'drake',
      thorn = type === 'thornback',
      wolf = type === 'wolf',
      legL = deer ? 0.52 : wolf ? 0.46 : pig ? 0.32 : 0.4,
      by = legL + (pig ? 0.2 : 0.17);
    const body: G[] = [
      part(
        capsule(pig ? 0.27 : wolf ? 0.18 : 0.22, pig ? 0.42 : 0.62),
        c,
        [0, 0, 0],
        [Math.PI / 2, 0, 0],
        [1, 1, 1.02],
      ),
      part(ball(pig ? 0.29 : wolf ? 0.21 : 0.25, 18), c, [0, 0.05, 0.22], [0, 0, 0], [1, 1.02, 1]),
      part(ball(0.2, 16), lt, [0, -0.1, 0.02], [0, 0, 0], [0.9, 0.7, 1.7]),
    ];
    if (pig)
      body.push(
        ...[0, 1, 2, 3, 4, 5, 6].map(i =>
          part(cone(0.035, 0.15, 6), dk, [0, 0.28 - Math.abs(i - 3) * 0.008, 0.36 - i * 0.12], [-0.4, 0, 0]),
        ),
        part(
          taper(
            [
              [0, 0.1, -0.5],
              [0.04, 0.16, -0.58],
              [-0.02, 0.12, -0.63],
            ],
            0.025,
            0.012,
            10,
            6,
          ),
          dk,
        ),
      );
    else if (drake)
      body.push(
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
            18,
            10,
          ),
          c,
        ),
        ...[0, 1, 2, 3, 4, 5].map(i =>
          part(
            cone(0.05, 0.16, 6),
            lt,
            [0, 0.25 - (i > 3 ? (i - 3) * 0.06 : 0), 0.3 - i * 0.2],
            [-0.4, 0, 0],
          ),
        ),
      );
    else
      body.push(
        part(
          taper(
            [
              [0, 0.06, -0.45],
              [0, 0.04, -0.62],
              [0.03, -0.1, -0.78],
            ],
            0.075,
            deer ? 0.03 : 0.05,
            12,
            8,
          ),
          dk,
        ),
        ...(thorn
          ? ring(5).flatMap((_, i) =>
              [-1, 0, 1].map(s =>
                part(
                  cone(0.05, 0.3, 7),
                  shade('#4f5636', 0.9 + (i % 2) * 0.2),
                  [s * 0.16, 0.24 - Math.abs(s) * 0.06, 0.32 - i * 0.17],
                  [-0.35, 0, -s * 0.5],
                ),
              ),
            )
          : []),
        ...(type === 'wolf'
          ? ring(8).map((a, i) =>
              part(blob(0.12, 2, 0.3, i), shade(c, 0.85 + (i % 2) * 0.15), [
                Math.cos(a) * 0.16,
                0.06 + Math.sin(a) * 0.16,
                0.36,
              ]),
            )
          : []),
      );
    parts.body = pivot(merge(body), 0, by);
    if (drake)
      for (const s of [-1, 1]) {
        const wing = pivot(
          merge([
            part(
              taper(
                [
                  [0, 0, 0],
                  [s * 0.4, 0.3, 0],
                  [s * 0.85, 0.2, -0.1],
                ],
                0.04,
                0.015,
                12,
                7,
              ),
              dk,
            ),
            part(
              plate(
                q => {
                  q.moveTo(0, 0);
                  q.quadraticCurveTo(0.35, 0.36, 0.85, 0.2);
                  q.quadraticCurveTo(0.68, 0, 0.62, -0.16);
                  q.quadraticCurveTo(0.45, -0.06, 0.34, -0.22);
                  q.quadraticCurveTo(0.2, -0.1, 0, -0.12);
                  q.closePath();
                },
                0.012,
                0.006,
              ),
              lt,
              [0, 0, 0],
              [0, s > 0 ? 0 : Math.PI, 0],
            ),
          ]),
          s * 0.16,
          0.18,
          0.1,
        );
        parts.body.add(wing);
        parts[s > 0 ? 'wl' : 'wr'] = wing;
      }
    const neckY = deer ? 0.42 : 0.1,
      hz = pig ? 0.16 : 0.2;
    const hd: G[] = [
      part(ball(pig ? 0.22 : 0.17, 18), c, [0, neckY, hz], [0, 0, 0], [0.95, 0.95, 1.1]),
      part(
        lathe(
          [
            [0.02, wolf ? 0.27 : 0.2],
            [pig ? 0.1 : 0.075, 0.19],
            [pig ? 0.13 : 0.11, 0.05],
            [0.14, -0.06],
          ],
          16,
        ),
        pig ? lt : shade(c, 1.08),
        [0, neckY - 0.05, hz + 0.1],
        [Math.PI / 2 + 0.12, 0, 0],
      ),
      part(
        ball(pig ? 0.075 : 0.04, 12),
        '#3a2f2a',
        [0, neckY - 0.05, hz + (pig ? 0.28 : 0.3)],
        [0, 0, 0],
        [1.1, 0.8, 0.5],
      ),
      ...eyes(0.1, neckY + 0.07, hz + 0.13, 0.034, drake ? '#e0b95a' : '#26231f'),
      part(
        taper(
          [
            [0, -0.02, -0.16],
            [0, neckY * 0.5, 0.02],
            [0, neckY, hz],
          ],
          deer ? 0.15 : 0.19,
          0.12,
          12,
          12,
        ),
        c,
      ),
      ...[-1, 1].map(s =>
        part(
          cone(0.065, wolf ? 0.24 : 0.17, 10),
          dk,
          [s * 0.12, neckY + 0.18, hz - 0.03],
          [-0.15, 0, -s * 0.35],
          [1, 1, 0.5],
        ),
      ),
    ];
    if (pig)
      for (const s of [-1, 1])
        hd.push(
          part(
            taper(
              [
                [s * 0.09, neckY - 0.1, hz + 0.2],
                [s * 0.15, neckY - 0.06, hz + 0.27],
                [s * 0.14, neckY + 0.05, hz + 0.28],
              ],
              0.03,
              0.006,
              10,
              8,
            ),
            '#efe6d2',
          ),
        );
    if (deer)
      for (const s of [-1, 1])
        hd.push(
          part(
            taper(
              [
                [s * 0.06, neckY + 0.13, hz],
                [s * 0.22, neckY + 0.35, hz - 0.08],
                [s * 0.3, neckY + 0.62, hz + 0.04],
              ],
              0.032,
              0.01,
              14,
              8,
            ),
            '#d4c8ae',
          ),
          ...[0.4, 0.62, 0.82].map((k, i) =>
            part(
              taper(
                [
                  [s * (0.1 + k * 0.17), neckY + 0.16 + k * 0.36, hz - 0.05],
                  [s * (0.18 + k * 0.24), neckY + 0.28 + k * 0.4, hz + 0.1 + i * 0.02],
                ],
                0.02,
                0.006,
                6,
                6,
              ),
              '#d4c8ae',
            ),
          ),
        );
    if (drake)
      for (const s of [-1, 1])
        hd.push(
          part(
            taper(
              [
                [s * 0.08, neckY + 0.13, hz - 0.02],
                [s * 0.14, neckY + 0.28, hz - 0.16],
                [s * 0.12, neckY + 0.4, hz - 0.34],
              ],
              0.04,
              0.008,
              12,
              8,
            ),
            '#d4c8ae',
          ),
        );
    parts.head = pivot(merge(hd), 0, by + 0.04, 0.36);
    parts.head.scale.setScalar(1.12);
    for (const [n, x, z] of [
      ['ll', 0.15, 0.26],
      ['rl', -0.15, 0.26],
      ['rb', 0.15, -0.26],
      ['lb', -0.15, -0.26],
    ] as const)
      parts[n] = pivot(
        merge([
          part(
            lathe(
              [
                [0.11, 0.06],
                [0.09, -0.06],
                [0.05, -legL * 0.55],
                [0.055, -legL + 0.05],
              ],
              12,
            ),
            shade(c, 0.88),
          ),
          part(
            lathe(
              [
                [0.065, -legL + 0.08],
                [0.075, -legL + 0.02],
                [0.07, -legL],
              ],
              12,
            ),
            '#3d342c',
          ),
        ]),
        x,
        legL,
        z,
      );
    root.scale.setScalar(0.9 + Math.min(0.55, d.level / 80));
    h = (by + 0.55 + (deer ? 0.45 : 0)) * root.scale.x;
  } else if (d.shape === 'wisp') {
    parts.body = pivot(
      merge([
        part(
          lathe(
            [
              [0.02, 0.42],
              [0.16, 0.3],
              [0.27, 0.06],
              [0.22, -0.2],
              [0.1, -0.5],
              [0.01, -0.85],
            ],
            22,
          ),
          c,
        ),
        ...ring(5).map((a, i) =>
          part(
            taper(
              [
                [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2],
                [Math.cos(a + 0.6) * 0.32, -0.32, Math.sin(a + 0.6) * 0.32],
                [Math.cos(a + 1.3) * 0.2, -0.7 - (i % 2) * 0.1, Math.sin(a + 1.3) * 0.2],
              ],
              0.07,
              0.006,
              14,
              8,
            ),
            shade(c, 0.85 + (i % 2) * 0.2),
          ),
        ),
        part(ball(0.17), '#f7f3e6', [0, 0.1, 0.13]),
        ...[-1, 1].map(s =>
          part(ball(0.035, 10), '#333a44', [s * 0.07, 0.13, 0.285], [0, 0, 0], [0.8, 1.4, 0.6]),
        ),
        ...(type === 'seer' ? [part(torus(0.3, 0.025), '#d9b25b', [0, 0.42, 0], [1.4, 0, 0])] : []),
      ]),
      0,
      1.05,
    );
    for (let i = 0; i < 3; i++) {
      const o = pivot(part(gem(0.07), lt), 0, 0);
      parts.body.add(o);
      parts['o' + i] = o;
    }
    h = 1.6;
  } else if (d.shape === 'plant') {
    parts.body = pivot(
      merge([
        part(
          taper(
            [
              [0, 0, 0],
              [0.1, 0.3, -0.06],
              [-0.04, 0.6, 0],
              [0, 0.82, 0.04],
            ],
            0.13,
            0.085,
            18,
            12,
          ),
          shade(c, 0.75),
        ),
        part(blob(0.3, 4, 0.1, 3), c, [0, 0.95, 0.04]),
        part(torus(0.14, 0.055), '#cf6a62', [0, 0.95, 0.3]),
        part(ball(0.13), '#3a2028', [0, 0.95, 0.25], [0, 0, 0], [1, 1, 0.6]),
        ...ring(8).map(a =>
          part(
            cone(0.025, 0.09, 8),
            '#f3ead6',
            [Math.cos(a) * 0.12, 0.95 + Math.sin(a) * 0.12, 0.35],
            [Math.PI / 2, 0, 0],
          ),
        ),
        ...ring(9).map(a =>
          part(
            blob(0.13, 2, 0.1, a),
            shade('#c9605a', 0.95),
            [Math.cos(a) * 0.32, 0.95 + Math.sin(a) * 0.32, 0.02],
            [0, 0, a],
            [1.4, 0.75, 0.3],
          ),
        ),
        ...eyes(0.13, 1.2, 0.18, 0.045),
        ...ring(7).map((a, i) =>
          part(
            taper(
              [
                [0, 0.06, 0],
                [Math.cos(a) * 0.3, 0.26, Math.sin(a) * 0.3],
                [Math.cos(a) * 0.58, 0.05 + (i % 2) * 0.06, Math.sin(a) * 0.58],
              ],
              0.085,
              0.008,
              12,
              7,
            ),
            shade(c, 0.85 + (i % 3) * 0.1),
            [0, 0, 0],
            [0, 0, 0],
            [1, 1, 1],
          ),
        ),
      ]),
      0,
      0,
    );
    h = 1.45;
  } else if (d.shape === 'golem') {
    const moss = '#7f9458',
      st = (r: number, p: V3, s = 1, k = 1) => part(blob(r, 4, 0.2, s, true), shade(c, k), p);
    parts.body = pivot(
      merge([
        st(0.46, [0, 0.36, 0], 3),
        st(0.3, [0.28, 0.55, -0.05], 5, 1.06),
        st(0.3, [-0.28, 0.55, -0.05], 8, 0.96),
        st(0.24, [0, 0.86, 0.1], 2, 1.1),
        part(rbox(0.3, 0.07, 0.1, 0.03), dk, [0, 0.95, 0.28]),
        ...eyes(0.085, 0.88, 0.31, 0.035, '#e0b95a'),
        part(blob(0.22, 3, 0.3, 4), moss, [0.2, 0.74, -0.1], [0, 0, 0], [1.2, 0.4, 1]),
        part(blob(0.16, 3, 0.3, 6), moss, [-0.3, 0.76, 0], [0, 0, 0], [1.2, 0.4, 1]),
      ]),
      0,
      0.55,
    );
    for (const [n, x] of [
      ['la', 0.56],
      ['ra', -0.56],
    ] as const)
      parts[n] = pivot(
        merge([
          st(0.19, [0, -0.1, 0], 2),
          st(0.17, [0, -0.38, 0.02], 4, 0.95),
          st(0.23, [0, -0.68, 0.06], 7, 1.06),
        ]),
        x,
        1.08,
      );
    for (const [n, x] of [
      ['ll', 0.22],
      ['rl', -0.22],
    ] as const)
      parts[n] = pivot(merge([st(0.2, [0, -0.06, 0], 5, 0.92), st(0.2, [0, -0.33, 0.04], 9, 0.86)]), x, 0.5);
    h = 1.75;
  } else if (d.shape === 'crab') {
    const b: G[] = [
      part(
        lathe(
          [
            [0.02, 0.48],
            [0.45, 0.44],
            [0.88, 0.18],
            [0.95, 0],
            [0.8, -0.16],
            [0.3, -0.24],
            [0.02, -0.24],
          ],
          30,
        ),
        c,
        [0, 0, 0],
        [0, 0, 0],
        [1, 1, 0.82],
      ),
      part(
        lathe(
          [
            [0.9, -0.1],
            [0.97, 0],
            [0.9, 0.1],
          ],
          30,
        ),
        lt,
        [0, 0, 0],
        [0, 0, 0],
        [1, 1, 0.83],
      ),
      ...ring(11).map((a, i) =>
        part(
          ball(0.06 + (i % 3) * 0.02, 10),
          shade(c, 0.75),
          [
            Math.cos(a) * (0.3 + (i % 3) * 0.16),
            0.42 - (i % 3) * 0.06,
            Math.sin(a) * (0.26 + (i % 3) * 0.12),
          ],
          [0, 0, 0],
          [1, 0.5, 1],
        ),
      ),
      ...(
        [
          [0.42, 0.42, -0.18, 0.17],
          [-0.36, 0.44, -0.28, 0.13],
          [-0.1, 0.47, -0.42, 0.1],
        ] as const
      ).map(([x, y, z, r]) =>
        part(
          lathe(
            [
              [r, 0],
              [r * 0.85, r * 0.7],
              [r * 0.5, r * 1.2],
              [r * 0.35, r * 1.1],
              [r * 0.3, r * 0.7],
            ],
            12,
          ),
          '#a9b5ad',
          [x, y - 0.06, z],
          [z, 0, -x * 0.5],
        ),
      ),
    ];
    for (const s of [-1, 1]) {
      b.push(
        part(
          taper(
            [
              [s * 0.24, 0.26, 0.6],
              [s * 0.26, 0.5, 0.7],
              [s * 0.27, 0.64, 0.72],
            ],
            0.06,
            0.05,
            10,
            10,
          ),
          c,
        ),
        part(ball(0.11), '#f3ecd8', [s * 0.27, 0.7, 0.73]),
        part(ball(0.06), '#26231f', [s * 0.27, 0.71, 0.82]),
      );
      for (let i = 0; i < 4; i++) {
        const z = 0.42 - i * 0.28;
        b.push(
          part(
            taper(
              [
                [s * 0.75, -0.05, z * 0.8],
                [s * 1.12, 0.2, z],
                [s * 1.3, -0.2, z * 1.1],
                [s * 1.36, -0.58, z * 1.15],
              ],
              0.1,
              0.02,
              18,
              10,
            ),
            shade(c, 0.85 + (i % 2) * 0.08),
          ),
        );
      }
    }
    for (const x of [-0.14, -0.05, 0.05, 0.14])
      b.push(
        part(
          taper(
            [
              [x, -0.06, 0.74],
              [x * 1.3, -0.14, 0.84],
              [x, -0.2, 0.84],
            ],
            0.035,
            0.015,
            8,
            7,
          ),
          lt,
        ),
      );
    parts.body = pivot(merge(b), 0, 0.6);
    const claw = (s: number) =>
      merge([
        part(
          taper(
            [
              [0, 0, 0],
              [s * 0.3, 0.06, 0.2],
              [s * 0.18, 0, 0.55],
            ],
            0.14,
            0.12,
            14,
            12,
          ),
          shade(c, 0.92),
        ),
        part(blob(0.3, 4, 0.07, 2), c, [s * 0.1, 0.02, 0.78], [0, 0, 0], [0.85, 0.8, 1.15]),
        part(
          taper(
            [
              [s * 0.24, 0.02, 0.9],
              [s * 0.34, 0.04, 1.2],
              [s * 0.1, 0.02, 1.46],
            ],
            0.15,
            0.015,
            14,
            12,
          ),
          lt,
        ),
        part(
          taper(
            [
              [s * -0.08, 0.02, 0.92],
              [s * -0.18, 0.04, 1.15],
              [s * 0.02, 0.02, 1.36],
            ],
            0.11,
            0.012,
            14,
            12,
          ),
          lt,
        ),
        ...[0, 1, 2, 3].map(i =>
          part(ball(0.035, 8), '#f0e2cc', [s * (0.19 - i * 0.015), 0.1, 1 + i * 0.09]),
        ),
      ]);
    parts.la = pivot(claw(1), 0.68, 0.6, 0.45);
    parts.ra = pivot(claw(-1), -0.68, 0.6, 0.45);
    h = 1.75;
  } else {
    const l = '#7f9a58',
      tr = lathe(
        [
          [1.25, 0],
          [0.98, 0.35],
          [0.82, 1],
          [0.84, 1.8],
          [0.74, 2.4],
          [0.5, 3],
        ],
        36,
      ),
      p = tr.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        z = p.getZ(i),
        a = Math.atan2(z, x),
        f = 1 + 0.06 * Math.sin(a * 9 + p.getY(i) * 0.8) + 0.03 * Math.sin(a * 17);
      p.setXYZ(i, x * f, p.getY(i), z * f);
    }
    tr.computeVertexNormals();
    parts.body = pivot(
      merge([
        part(tr, c),
        ...[-1, 1].flatMap(s => [
          part(ball(0.24), '#26241b', [s * 0.33, 2.02, 0.68], [0, 0, s * 0.3], [1, 0.75, 0.6]),
          part(ball(0.13), '#f0c55e', [s * 0.33, 2.02, 0.8], [0, 0, 0], [1, 0.8, 0.6]),
          part(
            taper(
              [
                [s * 0.1, 2.14, 0.84],
                [s * 0.34, 2.32, 0.82],
                [s * 0.64, 2.3, 0.58],
              ],
              0.1,
              0.05,
              12,
              10,
            ),
            shade(c, 0.78),
          ),
        ]),
        part(blob(0.15, 3, 0.2, 1), shade(c, 0.8), [0, 1.82, 0.88], [0, 0, 0], [0.8, 1.4, 0.8]),
        part(
          taper(
            [
              [-0.42, 1.42, 0.72],
              [0, 1.3, 0.86],
              [0.42, 1.42, 0.72],
            ],
            0.1,
            0.1,
            16,
            10,
          ),
          '#26241b',
          [0, 0, 0],
        ),
        ...[-0.24, -0.08, 0.08, 0.24].map(x =>
          part(cone(0.05, 0.16, 8), '#cdbf9a', [x, 1.33, 0.9], [Math.PI, 0, 0]),
        ),
        ...ring(9).map((a, i) =>
          part(
            taper(
              [
                [Math.cos(a) * 0.8, 0.5, Math.sin(a) * 0.8],
                [Math.cos(a) * 1.25, 0.34, Math.sin(a) * 1.25],
                [Math.cos(a + 0.2) * (1.65 + (i % 2) * 0.2), -0.05, Math.sin(a + 0.2) * 1.7],
              ],
              0.27,
              0.04,
              14,
              10,
            ),
            shade(c, 0.8 + (i % 3) * 0.08),
          ),
        ),
        part(blob(1.05, 5, 0.2, 2), l, [0, 3.55, 0], [0, 0, 0], [1.25, 0.8, 1.2]),
        ...ring(7).map((a, i) =>
          part(blob(0.62, 4, 0.22, i), shade(l, 0.86 + (i % 3) * 0.1), [
            Math.cos(a) * 1.05,
            3.1 + (i % 2) * 0.36,
            Math.sin(a) * 1.05,
          ]),
        ),
        ...ring(9)
          .filter(a => Math.sin(a) < 0.3)
          .map((a, i) =>
            part(
              blob(0.2, 3, 0.3, i),
              '#8fa560',
              [Math.cos(a) * 0.85, 0.9 + (i % 3) * 0.5, Math.sin(a) * 0.85],
              [0, 0, 0],
              [1, 0.6, 1],
            ),
          ),
        ...ring(4).map((a, i) =>
          part(
            taper(
              [
                [Math.cos(a) * 0.4, 3, Math.sin(a) * 0.4],
                [Math.cos(a) * 0.8, 3.9, Math.sin(a) * 0.8],
                [Math.cos(a) * 0.9, 4.5 + i * 0.1, Math.sin(a) * 0.7],
              ],
              0.14,
              0.03,
              12,
              8,
            ),
            shade(c, 0.9),
          ),
        ),
      ]),
      0,
      0,
    );
    const arm = (s: number) =>
      merge([
        part(
          taper(
            [
              [0, 0, 0],
              [s * 0.3, -0.5, 0.1],
              [s * 0.1, -1.1, 0.1],
              [0, -1.6, 0.15],
            ],
            0.34,
            0.24,
            20,
            14,
          ),
          shade(c, 0.92),
        ),
        part(blob(0.4, 4, 0.2, 3), shade(c, 0.82), [0, -1.75, 0.15]),
        ...[-1, 0, 1].map(i =>
          part(
            taper(
              [
                [i * 0.2, -1.85, 0.25],
                [i * 0.3, -2.1, 0.4],
                [i * 0.22, -2.3, 0.4],
              ],
              0.11,
              0.02,
              10,
              8,
            ),
            shade(c, 0.75),
          ),
        ),
        part(blob(0.3, 3, 0.25, 5), l, [s * 0.1, 0.05, 0], [0, 0, 0], [1.2, 0.6, 1.1]),
      ]);
    parts.la = pivot(arm(1), 0.95, 2.4);
    parts.ra = pivot(arm(-1), -0.95, 2.4);
    h = 4.6;
  }
  for (const p of Object.values(parts)) if (!p.parent) root.add(p);
  if (d.shape === 'golem' || d.shape === 'crab' || d.shape === 'treant')
    for (const k of ['la', 'ra']) parts[k].scale.setScalar(1.1);
  if (d.shape === 'wisp' || d.shape === 'plant') parts.body.scale.set(1.15, 1.1, 1.15);
  return { root, parts, h, kind: d.shape };
}
export function dropModel(item: string): Model {
  const i = ITEMS[item],
    c = i.color,
    root = new THREE.Group();
  let g: G;
  if (['sword', 'pickaxe', 'axe', 'bow', 'staff'].includes(i.icon)) {
    g = heldGeo(i.icon, c, i.unique);
    g.rotateX(Math.PI / 2);
    g.rotateY(0.6);
    g.translate(-0.15, 0.06, -0.2);
    g.scale(0.8, 0.8, 0.8);
  } else if (i.icon === 'log')
    g = merge([
      part(cyl(0.11, 0.12, 0.6), c, [0, 0.12, 0], [0, 0.5, Math.PI / 2]),
      part(cyl(0.1, 0.1, 0.61), '#e0cca0', [0, 0.12, 0], [0, 0.5, Math.PI / 2], [0.8, 1, 0.8]),
    ]);
  else if (i.icon === 'ore')
    g = merge([
      part(blob(0.18, 3, 0.25, 3, true), '#837f78', [0, 0.13, 0]),
      ...ring(4).map(a =>
        part(blob(0.06, 2, 0.2, a, true), c, [Math.cos(a) * 0.13, 0.17, Math.sin(a) * 0.13]),
      ),
    ]);
  else if (i.icon === 'bar')
    g = part(
      new THREE.CylinderGeometry(0.17, 0.24, 0.14, 4).rotateY(Math.PI / 4),
      c,
      [0, 0.08, 0],
      [0, 0.4, 0],
      [1.3, 1, 0.65],
    );
  else if (i.icon === 'gem' || i.icon === 'essence') g = part(gem(0.15), c, [0, 0.17, 0]);
  else if (i.icon === 'hide') g = part(blob(0.25, 3, 0.25, 2), c, [0, 0.05, 0], [0, 0, 0], [1.1, 0.25, 0.9]);
  else if (i.icon === 'meat')
    g = merge([
      part(blob(0.17, 3, 0.15, 2), c, [0, 0.13, 0], [0, 0, 0], [1.3, 0.75, 0.9]),
      part(cyl(0.025, 0.025, 0.2), '#efe6d2', [0.24, 0.13, 0], [0, 0, Math.PI / 2]),
      part(ball(0.04), '#efe6d2', [0.34, 0.13, 0]),
    ]);
  else
    g = merge([
      part(blob(0.18, 3, 0.08, 2), c, [0, 0.15, 0], [0, 0, 0], [1, 0.9, 1]),
      part(torus(0.07, 0.025), '#5a4632', [0, 0.3, 0], [Math.PI / 2, 0, 0]),
      part(
        lathe(
          [
            [0.05, 0],
            [0.11, 0.1],
          ],
          12,
        ),
        c,
        [0, 0.3, 0],
      ),
    ]);
  root.add(mesh(g));
  if (i.unique) {
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 4, 12),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45 }),
    );
    b.position.y = 2;
    root.add(b);
  }
  return { root, parts: {}, h: 0.4, kind: 'd' };
}
export function graveModel(): Model {
  const root = new THREE.Group(),
    s = '#9a978f';
  root.add(
    mesh(
      merge([
        part(
          plate(
            q => {
              q.moveTo(-0.26, 0);
              q.lineTo(-0.26, 0.55);
              q.absarc(0, 0.55, 0.26, Math.PI, 0, true);
              q.lineTo(0.26, 0);
              q.closePath();
            },
            0.12,
            0.025,
          ),
          s,
        ),
        part(rbox(0.22, 0.04, 0.02, 0.01), shade(s, 0.7), [0, 0.52, 0.09]),
        part(rbox(0.04, 0.26, 0.02, 0.01), shade(s, 0.7), [0, 0.48, 0.09]),
        part(blob(0.42, 4, 0.12, 2), '#6d5f48', [0, 0, 0.42], [0, 0, 0], [0.9, 0.28, 1.15]),
        ...ring(5).map((a, i) =>
          part(blob(0.07, 2, 0.2, i, true), shade(s, 0.9), [
            Math.cos(a) * 0.38,
            0.03,
            0.42 + Math.sin(a) * 0.5,
          ]),
        ),
      ]),
    ),
  );
  return { root, parts: {}, h: 1, kind: 'g' };
}
// --- animation
const ease = (t: number) => t * t * (3 - 2 * t),
  mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** 0 = resting on target, 1 = fully raised. Slow lift, fast strike, short rest. */
export const swing = (p: number) => (p < 0.55 ? ease(p / 0.55) : p < 0.7 ? 1 - ((p - 0.55) / 0.15) ** 2 : 0);
export const STRIKE_AT = 0.7;
export interface Pose {
  act?: string;
  walk: number;
  moving: boolean;
  hit: number;
  t: number;
  tool?: string;
}
/** Sets every joint. `hit` runs 1 to 0 after an attack; `t` is milliseconds. */
export function posePlayer(m: Model, o: Pose) {
  const p = m.parts,
    w = o.moving ? Math.sin(o.walk) : 0,
    aw = Math.abs(Math.cos(o.walk)),
    br = Math.sin(o.t / 700) * 0.012;
  let lean = o.moving ? 0.08 : br,
    twist = -w * 0.12,
    la = -w * 0.6,
    ra = w * 0.6,
    la2 = -0.26,
    ra2 = -0.26,
    lz = 0.15,
    rz = -0.15,
    ll = w * 0.75,
    rl = -w * 0.75,
    drop = o.moving ? aw * 0.035 : 0,
    hx = 0;
  let ll2 = o.moving ? Math.max(0, -Math.sin(o.walk + 0.9)) * 0.9 + 0.1 : 0,
    rl2 = o.moving ? Math.max(0, Math.sin(o.walk + 0.9)) * 0.9 + 0.1 : 0;
  const a = o.act,
    cyc = (ms: number) => (o.t % ms) / ms,
    stance = () => {
      if (!o.moving) {
        ll = -0.3;
        rl = 0.26;
        ll2 = 0.2;
        rl2 = 0.1;
        drop = -0.03;
      }
    };
  if (a === 'mine' || a === 'chop') {
    const s = swing(cyc(1200));
    stance();
    lean = mix(0.34, -0.14, s);
    hx = mix(0, 0.1, s);
    twist = a === 'chop' ? mix(-0.25, 0.5, s) : mix(-0.05, 0.12, s);
    ra = mix(-1.0, -2.35, s);
    ra2 = mix(-0.15, -0.75, s);
    rz = 0.16;
    la = mix(-1.15, -2.1, s);
    la2 = mix(-0.35, -0.95, s);
    lz = -0.5;
  } else if (a === 'craft') {
    const s = swing(cyc(750));
    lean = 0.18;
    hx = 0.2;
    ra = mix(-0.7, -1.5, s);
    ra2 = mix(-0.3, -0.9, s);
    la = -0.75;
    la2 = -0.5;
    lz = -0.1;
  } else if (a === 'pick') {
    const s = Math.sin(o.t / 260);
    lean = 0.72;
    hx = 0.1;
    ll = -0.5;
    rl = 0.1;
    ll2 = 0.8;
    rl2 = 0.6;
    drop = -0.13;
    la = -0.95 + s * 0.2;
    ra = -0.95 - s * 0.2;
    la2 = ra2 = -0.3;
  } else if (a === 'eat') {
    ra = -1.2;
    ra2 = -1.7 + Math.sin(o.t / 90) * 0.12;
    rz = 0.3;
    hx = 0.12;
  } else if (a === 'ranged') {
    stance();
    twist = 0.55;
    la = -1.5;
    la2 = -0.06;
    lz = -0.45;
    const d = 1 - o.hit;
    ra = -1.45;
    ra2 = mix(-0.7, -1.9, ease(Math.min(1, d * 1.6)));
    rz = -0.35;
    hx = 0;
  } else if (a === 'magic') {
    stance();
    const f = o.hit;
    ra = mix(-1.25, -1.75, f);
    ra2 = mix(-0.5, -0.05, f);
    la = mix(-0.5, -1.6, f);
    la2 = mix(-0.7, -0.15, f);
    lean = f * 0.14;
  } else if (a === 'melee') {
    stance();
    ra = -0.7;
    ra2 = -0.75;
    la = -0.5;
    la2 = -0.9;
    if (o.hit > 0) {
      // Wind up, cut down fast, hold, then return to guard.
      const q = 1 - o.hit,
        key = (g: number, up: number, down: number) =>
          q < 0.3
            ? mix(g, up, ease(q / 0.3))
            : q < 0.5
              ? mix(up, down, ((q - 0.3) / 0.2) ** 2)
              : q < 0.75
                ? down
                : mix(down, g, ease((q - 0.75) / 0.25));
      ra = key(-0.7, -2.5, -0.45);
      ra2 = key(-0.75, -0.8, 0);
      twist = key(0, 0.4, -0.45);
      lean = key(lean, -0.08, 0.26);
      la = key(-0.5, -0.8, 0.2);
      hx = key(0, 0.05, 0.1);
    }
  }
  p.upper.rotation.set(lean, twist, 0);
  p.upper.position.y = p.hips.position.y = HIP + drop;
  p.hips.rotation.set(lean * 0.45, twist * 0.3, 0);
  p.head.rotation.set(hx - lean * 0.6, -twist * 0.7, 0);
  p.la.rotation.set(la, 0, lz);
  p.ra.rotation.set(ra, 0, rz);
  p.la2.rotation.x = la2;
  p.ra2.rotation.x = ra2;
  p.ll.rotation.x = ll;
  p.rl.rotation.x = rl;
  p.ll.rotation.z = o.moving ? 0.015 : 0.055;
  p.rl.rotation.z = -p.ll.rotation.z;
  p.ll2.rotation.x = ll2;
  p.rl2.rotation.x = rl2;
  p.ll.position.y = p.rl.position.y = HIP + drop;
  const want = a === 'mine' || a === 'chop' ? o.tool : a === 'craft' ? 'hammer' : undefined;
  if (p.tool?.userData.id !== want) {
    if (p.tool) {
      p.rah.remove(p.tool);
      (p.tool as THREE.Mesh).geometry.dispose();
      delete p.tool;
    }
    if (want) {
      const i = ITEMS[want],
        g = mesh(heldGeo(i?.icon ?? 'hammer', i?.color ?? '#6b7177'));
      g.userData.id = want;
      g.scale.setScalar(1.1);
      g.rotation.x = want === 'hammer' ? 1.75 : 2.1;
      p.rah.add(g);
      p.tool = g;
    }
  }
  if (p.weapon) p.weapon.visible = !want && a !== 'pick' && a !== 'eat';
}
export function poseMonster(m: Model, o: Pose & { x: number }) {
  const p = m.parts,
    w = o.moving ? Math.sin(o.walk) * 0.65 : 0,
    br = Math.sin(o.t / 600 + o.x);
  for (const [k, s] of [
    ['ll', 1],
    ['rl', -1],
    ['lb', 1],
    ['rb', -1],
  ] as const)
    if (p[k]) p[k].rotation.x = w * s;
  if (m.kind === 'wisp') {
    p.body.position.y = 1.05 + Math.sin(o.t / 450 + o.x) * 0.12;
    p.body.rotation.x = o.hit * 0.5;
    for (let i = 0; i < 3; i++) {
      const a = o.t / 700 + (i * TAU) / 3;
      p['o' + i].position.set(Math.cos(a) * 0.45, 0.1 + Math.sin(a * 2) * 0.12, Math.sin(a) * 0.45);
    }
  } else if (m.kind === 'plant') {
    p.body.rotation.set(Math.sin(o.hit * Math.PI) * 0.35, 0, br * 0.05);
  } else if (m.kind === 'golem') {
    p.la.rotation.x = -w;
    p.ra.rotation.x = w - Math.sin(o.hit * Math.PI) * 2;
    p.body.rotation.x = Math.sin(o.hit * Math.PI) * 0.2;
  } else {
    p.head.rotation.x = br * 0.05 + Math.sin(o.hit * Math.PI) * 0.45;
    p.body.rotation.x = -Math.sin(o.hit * Math.PI) * 0.08;
    if (p.wl) {
      p.wl.rotation.z = 0.25 + Math.sin(o.t / 220) * 0.3;
      p.wr.rotation.z = -p.wl.rotation.z;
    }
  }
}
