// Grass, flowers and pebbles scattered over a map. Decoration only.
import { type GameMap, groundHeight, T } from '@driftwake/shared';
import * as THREE from 'three';
import { blob, MAT, merge, part, shade, taper } from '../geo';

const BLADES = [0, 1, 2, 3, 4];

function grassBlades(): THREE.BufferGeometry[] {
  return BLADES.map(i => {
    const angle = i * 1.26;
    const x = Math.cos(angle);
    const z = Math.sin(angle);
    const tip = 0.2 + (i % 2) * 0.06;
    const curve = taper(
      [
        [x * 0.03, 0, z * 0.03],
        [x * 0.05, 0.12, z * 0.05],
        [x * 0.13, tip, z * 0.13],
      ],
      0.016,
      0.002,
      3,
      4,
    );
    return part(curve, shade('#97c47c', 0.9 + (i % 3) * 0.08));
  });
}

function flower(): THREE.BufferGeometry {
  const petals = BLADES.map(i => {
    const angle = i * 1.26;
    return part(blob(0.03, 0, 0), '#f0e6c8', [0.02 + Math.cos(angle) * 0.045, 0.27, Math.sin(angle) * 0.045]);
  });
  return merge([
    ...grassBlades().slice(0, 2),
    part(
      taper(
        [
          [0, 0, 0],
          [0.02, 0.26, 0],
        ],
        0.012,
        0.01,
        4,
      ),
      '#7d9660',
    ),
    ...petals,
    part(blob(0.028, 0, 0), '#dcb45e', [0.02, 0.28, 0]),
  ]);
}

const pebbles = () =>
  merge([
    part(blob(0.07, 0.25, 1), '#a39d92', [0, 0.02, 0]),
    part(blob(0.04, 0.2, 2), '#938d84', [0.09, 0.01, 0.04]),
  ]);

interface Scatter {
  geometry: THREE.BufferGeometry;
  count: number;
  growsOn: (tile: number) => boolean;
}

/** `density` is 0 to 1 from the graphics quality setting. */
export function groundDetail(map: GameMap, random: () => number, density = 1): THREE.InstancedMesh[] {
  if (density <= 0) return [];
  const onGrass = (tile: number) => tile === T.GRASS;
  const onBareGround = (tile: number) => tile !== T.GRASS && tile !== T.PATH;
  const scatters: Scatter[] = [
    { geometry: merge(grassBlades().slice(0, 3)), count: map.size * 10 * density, growsOn: onGrass },
    { geometry: flower(), count: map.size * 1.5 * density, growsOn: onGrass },
    { geometry: pebbles(), count: map.size * 3 * density, growsOn: onBareGround },
  ];
  return scatters.flatMap(scatter => {
    const placements = scatterPlacements(map, random, scatter);
    if (!placements.length) return [];
    const mesh = new THREE.InstancedMesh(scatter.geometry, MAT, placements.length);
    for (const [i, matrix] of placements.entries()) mesh.setMatrixAt(i, matrix);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return [mesh];
  });
}

const UP = new THREE.Vector3(0, 1, 0);

function scatterPlacements(map: GameMap, random: () => number, { count, growsOn }: Scatter): THREE.Matrix4[] {
  const out: THREE.Matrix4[] = [];
  for (let i = 0; i < count; i++) {
    const x = random() * map.size;
    const y = random() * map.size;
    const index = Math.floor(y) * map.size + Math.floor(x);
    const tile = map.tiles[index];
    if (map.blocked[index] || tile === T.WATER || tile === T.WOOD || !growsOn(tile)) continue;
    const scale = 0.75 + random() * 0.6;
    const turn = new THREE.Quaternion().setFromAxisAngle(UP, random() * 6.28);
    out.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, groundHeight(map, x, y), y),
        turn,
        new THREE.Vector3(scale, scale, scale),
      ),
    );
  }
  return out;
}
