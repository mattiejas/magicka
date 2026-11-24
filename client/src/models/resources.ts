// Resource nodes: trees, rocks and plants, each whole and depleted.
import { NODES, type NodeDef, WOOD_COLORS } from '@magicka/shared';
import { ball, bend, blob, crystal, cyl, gem, lathe, merge, part, shade, taper, torus } from '../geo';
import { type Geometry, ring } from './model';

export interface NodeShape {
  whole: Geometry;
  depleted: Geometry;
  height: number;
}
const LEAF_COLORS = ['', '#9cc463', '#4c8f76', '#6aa356', '#dd8350', '#6b64a0'];
const PINE_TIER = 2;
const MAPLE_TIER = 4;

export function nodeGeo(type: string): NodeShape {
  const node = NODES[type];
  if (node.kind === 'tree') return node.tier === PINE_TIER ? pine(node) : leafyTree(node);
  if (node.kind === 'rock') return rock(node);
  return type === 'berry_bush' ? berryBush(node) : flowers(node);
}

// --- trees
const roots = (bark: string) =>
  ring(5).map((a, i) =>
    part(
      taper(
        [
          [Math.cos(a) * 0.1, 0.24, Math.sin(a) * 0.1],
          [Math.cos(a) * 0.26, 0.09, Math.sin(a) * 0.26],
          [Math.cos(a) * (0.42 + (i % 2) * 0.08), -0.02, Math.sin(a) * 0.44],
        ],
        0.1,
        0.03,
      ),
      shade(bark, 0.85),
    ),
  );

const stump = (bark: string) =>
  merge([
    part(
      lathe(
        [
          [0.31, 0],
          [0.24, 0.12],
          [0.21, 0.36],
        ],
        8,
      ),
      bark,
    ),
    part(cyl(0.21, 0.21, 0.03), shade(bark, 1.45), [0, 0.37, 0]),
    part(torus(0.12, 0.008), shade(bark, 1.1), [0, 0.39, 0], [Math.PI / 2, 0, 0]),
    ...roots(bark),
  ]);

const trunk = (bark: string) => [
  part(
    lathe([
      [0.31, 0],
      [0.21, 0.18],
      [0.17, 0.6],
      [0.14, 1.2],
      [0.09, 1.9],
      [0.05, 2.3],
    ]),
    bark,
  ),
  ...roots(bark),
];

function pine({ tier }: NodeDef): NodeShape {
  const bark = WOOD_COLORS[tier];
  const leaf = LEAF_COLORS[tier];
  const skirts = [0, 1, 2, 3, 4].map(i => {
    const r = 0.92 - i * 0.16,
      y = 0.95 + i * 0.46,
      g = lathe([
        [0.02, 0.75],
        [r * 0.4, 0.4],
        [r * 0.82, 0.08],
        [r, 0],
        [r * 0.6, 0.06],
        [0.06, 0.12],
      ]),
      p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k),
        z = p.getZ(k),
        q = Math.hypot(x, z) / r,
        f = 1 + 0.09 * q * Math.sin(Math.atan2(z, x) * 4 + i);
      p.setXYZ(k, x * f, p.getY(k) - 0.07 * q * Math.sin(Math.atan2(z, x) * 4 + i), z * f);
    }
    g.computeVertexNormals();
    return part(g, shade(leaf, 0.88 + i * 0.06), [0, y, 0], [0, i, 0]);
  });
  return { whole: bend(merge([...trunk(bark), ...skirts]), 0.16), depleted: stump(bark), height: 3.3 };
}

function leafyTree({ tier }: NodeDef): NodeShape {
  const bark = WOOD_COLORS[tier];
  const leaf = LEAF_COLORS[tier];
  const spread = tier === MAPLE_TIER ? 1.1 : 1;
  const limbs = ring(4).map((a, i) =>
    part(
      taper(
        [
          [0, 1 + i * 0.12, 0],
          [Math.cos(a) * 0.3, 1.45 + i * 0.1, Math.sin(a) * 0.3],
          [Math.cos(a) * 0.55, 1.85, Math.sin(a) * 0.55],
        ],
        0.08,
        0.03,
      ),
      bark,
    ),
  );
  const crown = [
    part(blob(0.82, 0.14, tier), leaf, [0, 2.2, 0], [0, 0, 0], [1.3 * spread, 0.62, 1.3 * spread]),
    part(
      blob(0.66, 0.14, tier + 3),
      shade(leaf, 1.1),
      [0.16, 2.75, 0.05],
      [0, 0, 0],
      [1.1 * spread, 0.6, 1.1 * spread],
    ),
    ...ring(3).map((a, i) =>
      part(
        blob(0.4, 0.16, i + tier),
        shade(leaf, 0.92),
        [Math.cos(a) * 0.82 * spread, 1.82 + i * 0.1, Math.sin(a) * 0.82 * spread],
        [0, 0, 0],
        [1.2, 0.6, 1.2],
      ),
    ),
    part(blob(0.4, 0.14, 9), shade(leaf, 1.2), [0.02, 3.15, 0], [0, 0, 0], [1.1, 0.65, 1.1]),
  ];
  return {
    whole: bend(merge([...trunk(bark), ...limbs, ...crown]), 0.22),
    depleted: stump(bark),
    height: 3.1,
  };
}

// --- rocks
const crystals = (color: string) =>
  ring(6).map((a, i) =>
    part(
      crystal(0.075 + (i % 2) * 0.03, 0.5 + (i % 3) * 0.16),
      shade(color, 0.95 + (i % 3) * 0.1),
      [Math.cos(a) * 0.22, 0.62, Math.sin(a) * 0.22],
      [Math.sin(a) * 0.45, i, -Math.cos(a) * 0.45],
    ),
  );

const oreShards = (color: string) =>
  ring(9).map((a, i) => {
    const up = [0.2, 0.48, 0.74][i % 3],
      r = [0.45, 0.42, 0.28][i % 3];
    return part(
      gem(0.14 + (i % 2) * 0.05),
      shade(color, 0.95 + (i % 3) * 0.13),
      [Math.cos(a) * r, up, Math.sin(a) * r],
      [a, i, 0],
      [1, 0.75, 1],
    );
  });

function rock({ id, tier, color }: NodeDef): NodeShape {
  const isEssence = id === 'essence_rock';
  const base = isEssence ? '#7b7f92' : '#938d8c';
  const stones = [
    part(blob(0.47, 0.2, 2 + tier), base, [0, 0.36, 0], [0, tier, 0.12], [0.95, 1.2, 0.9]),
    part(blob(0.32, 0.2, 7), shade(base, 0.9), [0.3, 0.2, 0.18], [0, 0, -0.35], [0.8, 1.25, 0.8]),
    part(blob(0.2, 0.26, 4), shade(base, 1.06), [-0.34, 0.08, 0.24]),
    part(blob(0.12, 0.2, 1), shade(base, 0.95), [-0.1, 0.04, 0.46]),
  ];
  const vein = isEssence ? crystals(color) : oreShards(color);
  return { whole: merge([...stones, ...vein]), depleted: merge(stones), height: 0.95 };
}

// --- plants
function berryBush({ color }: NodeDef): NodeShape {
  const bush = [
    part(blob(0.38, 0.2, 1), '#5f8050', [0, 0.34, 0]),
    ...ring(5).map((a, i) =>
      part(blob(0.22, 0.2, i), shade('#678a55', 0.92 + (i % 3) * 0.08), [
        Math.cos(a) * 0.28,
        0.24 + (i % 2) * 0.12,
        Math.sin(a) * 0.28,
      ]),
    ),
  ];
  const berries = ring(12).map((a, i) =>
    part(ball(0.055), shade(color, 0.95 + (i % 2) * 0.2), [
      Math.cos(a) * 0.42,
      0.22 + (i % 4) * 0.11,
      Math.sin(a) * 0.42,
    ]),
  );
  return { whole: merge([...bush, ...berries]), depleted: merge(bush), height: 0.8 };
}

function flowers({ color }: NodeDef): NodeShape {
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
        5,
      ),
      shade('#6f8a52', 0.9 + (i % 3) * 0.1),
    ),
  );
  const heads = ring(6).flatMap((a, i): Geometry[] => {
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
          5,
        ),
        '#7d9660',
      ),
      part(ball(0.045), shade(color, 0.75), [x, y, z]),
      ...ring(5).map(b =>
        part(ball(0.05), color, [x + Math.cos(b) * 0.07, y, z + Math.sin(b) * 0.07], [0, 0, 0], [1, 0.5, 1]),
      ),
    ];
  });
  return { whole: merge([...blades, ...heads]), depleted: merge(blades), height: 0.8 };
}
