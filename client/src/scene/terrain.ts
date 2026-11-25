// The ground of a map: a coarse faceted mesh, faint tile lines and the dock planks.
import { type GameMap, T, groundHeight as tileHeight } from '@driftwake/shared';
import * as THREE from 'three';
import { MAT, merge, noise, part, rbox, shade } from '../geo';
import { TILE_COLORS } from './palette';

/** Ground vertices per tile edge. */
const SUBDIVISIONS = 2;
const WET_SAND = new THREE.Color('#e0bf88');
const DEEP = new THREE.Color('#2a6c8c');
const FOAM = new THREE.Color('#ffffff');
/** Cave walls: how high they stand, and their colour at the foot and on top. */
const WALL_HEIGHT = 1.15;
const WALL_FOOT = new THREE.Color('#6a635f');
const WALL_TOP = new THREE.Color('#2b2830');
const TILE_LINE_HEIGHT = 0.012;

export function terrain(map: GameMap): THREE.Group {
  const group = new THREE.Group();
  group.add(ground(map), tileLines(map));
  const dock = planks(map);
  if (dock) group.add(dock);
  return group;
}

/** Tile type at a position. Docks stand in water, and so does everything off the map. */
function groundAt(map: GameMap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.size || y >= map.size) return T.WATER;
  const tile = map.tiles[y * map.size + x];
  return tile === T.WOOD ? T.WATER : tile;
}

/** The four tiles around a point and how much each counts. */
function neighbours(x: number, y: number, ease = (t: number) => t): [x: number, y: number, weight: number][] {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = ease(x - x0);
  const fy = ease(y - y0);
  return [
    [x0, y0, (1 - fx) * (1 - fy)],
    [x0 + 1, y0, fx * (1 - fy)],
    [x0, y0 + 1, (1 - fx) * fy],
    [x0 + 1, y0 + 1, fx * fy],
  ];
}

/** How much of a point is land: 1 inland, 0 at sea, in between along the shore. */
function landShare(map: GameMap, x: number, y: number): number {
  let share = 0;
  for (const [tx, ty, weight] of neighbours(x, y)) if (groundAt(map, tx, ty) !== T.WATER) share += weight;
  return share;
}

/** How far the ground dips towards the sea along the shore. */
function shoreDip(land: number): number {
  if (land >= 1) return 0;
  if (land > 0.5) return -0.16 * (1 - (land - 0.5) * 2) ** 2;
  return -0.16 - (0.5 - land) * 1.6;
}

/** The height of the map's ground, falling to the sea along the shore, which cuts a cliff short. */
function shoreHeight(map: GameMap, x: number, z: number, land: number): number {
  return tileHeight(map, x, z) * THREE.MathUtils.smoothstep(land, 0.5, 1) + shoreDip(land);
}

/** A cave's floor is flat up to a short, steep wall. */
const wallHeight = (floor: number) => WALL_HEIGHT * THREE.MathUtils.smoothstep(1 - floor, 0.3, 0.8);

const sharpBlend = (t: number) => THREE.MathUtils.smoothstep(t, 0.42, 0.58);

function groundColor(map: GameMap, x: number, y: number, land: number): THREE.Color {
  const wobbleX = noise((x + 0.5) * 1.9, (y + 0.5) * 1.9, 3) * 0.2;
  const wobbleY = noise((x + 0.5) * 1.9, (y + 0.5) * 1.9, 9) * 0.2;
  const color = new THREE.Color(0, 0, 0);
  let total = 0;
  for (const [tx, ty, weight] of neighbours(x + wobbleX, y + wobbleY, sharpBlend)) {
    const tile = groundAt(map, tx, ty);
    if (tile === T.WATER || !weight) continue;
    color.add(new THREE.Color(TILE_COLORS[tile]).multiplyScalar(weight));
    total += weight;
  }
  if (total) color.multiplyScalar(1 / total);
  if (map.cave) {
    color.multiplyScalar(0.75);
    if (land < 1) color.lerp(WALL_FOOT, 0.8);
    if (land < 0.7) color.lerp(WALL_TOP, 1 - land / 0.7);
    return color.multiplyScalar(0.97 + noise(x * 2.3, y * 2.3, 4) * 0.08);
  }
  if (!total) color.copy(WET_SAND);
  if (land < 1) color.lerp(WET_SAND, (1 - land) * 0.6);
  if (land < 0.5) color.lerp(DEEP, (0.5 - land) * 1.8);
  if (land >= 0.25 && land < 0.5) color.lerp(FOAM, 0.8);
  const wx = x + 0.5;
  const wy = y + 0.5;
  return color.multiplyScalar(0.98 + noise(wx * 0.9, wy * 0.9, 1) * 0.045 + noise(wx * 5, wy * 5, 2) * 0.02);
}

function ground(map: GameMap): THREE.Mesh {
  const side = map.size * SUBDIVISIONS + 1;
  const positions: number[] = [];
  const colors: number[] = [];
  for (let row = 0; row < side; row++)
    for (let column = 0; column < side; column++) {
      const worldX = column / SUBDIVISIONS;
      const worldZ = row / SUBDIVISIONS;
      // Tile centres sit half a tile in from the corner.
      const land = landShare(map, worldX - 0.5, worldZ - 0.5);
      const uneven = map.cave && land < 0.4 ? noise(worldX * 1.7, worldZ * 1.7, 6) * 0.22 : 0;
      positions.push(
        worldX,
        (map.cave ? wallHeight(land) : shoreHeight(map, worldX, worldZ, land)) + uneven,
        worldZ,
      );
      colors.push(...groundColor(map, worldX - 0.5, worldZ - 0.5, land).toArray());
    }
  const index: number[] = [];
  for (let row = 0; row < side - 1; row++)
    for (let column = 0; column < side - 1; column++) {
      const corner = row * side + column;
      index.push(corner, corner + side, corner + 1, corner + 1, corner + side, corner + side + 1);
    }
  const shared = new THREE.BufferGeometry();
  shared.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shared.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  shared.setIndex(index);
  const geometry = shared.toNonIndexed();
  geometry.computeVertexNormals();
  facetColors(geometry);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  return mesh;
}

/** Pulls each face almost to its own average, so the ground reads as facets like everything on it. */
function facetColors(geometry: THREE.BufferGeometry) {
  const { color, position } = geometry.attributes;
  for (let face = 0; face < color.count; face += 3) {
    const vertices = [face, face + 1, face + 2];
    const tint = 1 + noise(position.getX(face) * 7.3, position.getZ(face) * 5.9, (face / 3) % 2) * 0.045;
    for (const channel of [0, 1, 2]) {
      const average = vertices.reduce((sum, v) => sum + color.getComponent(v, channel), 0) / 3;
      for (const v of vertices)
        color.setComponent(v, channel, (color.getComponent(v, channel) * 0.1 + average * 0.9) * tint);
    }
  }
}

/** Faint lines that keep distances readable. They follow the ground, so an edge is cut in two on a slope. */
function tileLines(map: GameMap): THREE.LineSegments {
  const points: number[] = [];
  const edge = (x1: number, z1: number, x2: number, z2: number) => {
    const middle = [(x1 + x2) / 2, (z1 + z2) / 2] as const;
    const heights = [[x1, z1], middle, [x2, z2]].map(([x, z]) => lineHeight(map, x, z));
    if (Math.abs(heights[0] + heights[2] - 2 * heights[1]) < 1e-3) {
      points.push(x1, heights[0], z1, x2, heights[2], z2);
      return;
    }
    points.push(x1, heights[0], z1, middle[0], heights[1], middle[1]);
    points.push(middle[0], heights[1], middle[1], x2, heights[2], z2);
  };
  for (let y = 0; y < map.size; y++)
    for (let x = 0; x < map.size; x++)
      if (groundAt(map, x, y) !== T.WATER) {
        edge(x, y, x + 1, y);
        edge(x, y, x, y + 1);
      }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const material = new THREE.LineBasicMaterial({
    color: '#4a3f30',
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });
  return new THREE.LineSegments(geometry, material);
}

const lineHeight = (map: GameMap, x: number, z: number) => tileHeight(map, x, z) + TILE_LINE_HEIGHT;

function planks(map: GameMap): THREE.Mesh | null {
  const isWood = (x: number, y: number) => map.tiles[y * map.size + x] === T.WOOD;
  const parts: THREE.BufferGeometry[] = [];
  for (let y = 0; y < map.size; y++)
    for (let x = 0; x < map.size; x++) {
      if (!isWood(x, y)) continue;
      for (let i = 0; i < 3; i++) {
        const color = shade('#a3825a', 0.93 + ((x * 3 + y * 5 + i * 2) % 5) * 0.035);
        parts.push(part(rbox(0.99, 0.09, 0.3, 0.02), color, [x + 0.5, -0.045, y + 0.17 + i * 0.33]));
      }
      const leftEdge = !isWood(x - 1, y);
      if (y % 3 === 0 && (leftEdge || !isWood(x + 1, y))) {
        const post = new THREE.CylinderGeometry(0.09, 0.1, 1.1, 12);
        parts.push(part(post, '#7d6144', [x + (leftEdge ? 0.02 : 0.98), -0.2, y + 0.5]));
      }
    }
  if (!parts.length) return null;
  const mesh = new THREE.Mesh(merge(parts), MAT);
  mesh.receiveShadow = mesh.castShadow = true;
  return mesh;
}
