// The slabs that make a path tile look like laid stone, and nothing grows between them.
import { type GameMap, groundHeight, T } from '@driftwake/shared';
import * as THREE from 'three';
import { MAT, part, rbox } from '../geo';
import { SLAB_COLOR } from './palette';

/** Slabs per tile edge, their size as a share of a tile, and how far they sit above the ground. */
const PER_EDGE = 2;
const SLAB_SIZE = 0.44;
const SLAB_THICKNESS = 0.06;
const SLAB_LIFT = 0.02;
const UP = new THREE.Vector3(0, 1, 0);

/** A repeatable number between 0 and 1 for a tile, so the same path is laid the same way for everyone. */
const hash = (x: number, y: number, k: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
};

/** One mesh for all paving of a map, or null where there is none. */
export function paving(map: GameMap): THREE.InstancedMesh | null {
  const tiles: [number, number][] = [];
  for (let y = 0; y < map.size; y++)
    for (let x = 0; x < map.size; x++) if (map.tiles[y * map.size + x] === T.PATH) tiles.push([x, y]);
  if (!tiles.length) return null;
  const slab = part(rbox(SLAB_SIZE, SLAB_THICKNESS, SLAB_SIZE, 0.02), SLAB_COLOR);
  const mesh = new THREE.InstancedMesh(slab, MAT, tiles.length * PER_EDGE * PER_EDGE);
  const place = new THREE.Matrix4();
  const tint = new THREE.Color();
  let index = 0;
  for (const [x, y] of tiles)
    for (let i = 0; i < PER_EDGE * PER_EDGE; i++) {
      const jitter = (k: number) => (hash(x, y, i * 4 + k) - 0.5) * 0.06;
      const px = x + (0.5 + (i % PER_EDGE)) / PER_EDGE + jitter(0);
      const pz = y + (0.5 + Math.floor(i / PER_EDGE)) / PER_EDGE + jitter(1);
      const lean = ground(map, px, pz);
      const turn = new THREE.Quaternion().setFromAxisAngle(UP, (hash(x, y, i * 4 + 2) - 0.5) * 0.35);
      const grow = 0.92 + hash(x, y, i * 4 + 3) * 0.14;
      place.compose(
        new THREE.Vector3(px, lean.height + SLAB_LIFT, pz),
        lean.tilt.multiply(turn),
        new THREE.Vector3(grow, 1, grow),
      );
      mesh.setMatrixAt(index, place);
      mesh.setColorAt(index, tint.setScalar(0.9 + hash(x, y, i * 4 + 1) * 0.2));
      index++;
    }
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** The ground at a point: its height, and the turn that lays a slab flat on it. */
function ground(map: GameMap, x: number, z: number) {
  const reach = 0.25;
  const slopeX = (groundHeight(map, x + reach, z) - groundHeight(map, x - reach, z)) / (2 * reach);
  const slopeZ = (groundHeight(map, x, z + reach) - groundHeight(map, x, z - reach)) / (2 * reach);
  const normal = new THREE.Vector3(-slopeX, 1, -slopeZ).normalize();
  return { height: groundHeight(map, x, z), tilt: new THREE.Quaternion().setFromUnitVectors(UP, normal) };
}
