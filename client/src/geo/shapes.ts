// The shapes models are built from. Facet counts are chosen here, so the whole game shares one chunky style.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { noise, type V3 } from './paint';

type Geometry = THREE.BufferGeometry;

// --- simple shapes
/** A box with chamfered edges, unless it is too thin for them. */
export function rbox(width: number, height: number, depth: number, chamfer = 0.05): Geometry {
  const thinnest = Math.min(width, height, depth);
  if (thinnest < 0.08) return new THREE.BoxGeometry(width, height, depth);
  return new RoundedBoxGeometry(width, height, depth, 1, Math.min(chamfer, thinnest * 0.25));
}

export function ball(radius: number, fine = false): Geometry {
  if (radius < 0.06) return new THREE.SphereGeometry(radius, 7, 5);
  return fine ? new THREE.SphereGeometry(radius, 12, 8) : new THREE.SphereGeometry(radius, 9, 6);
}

export const cyl = (top: number, bottom: number, height: number, sides = 10): Geometry =>
  new THREE.CylinderGeometry(top, bottom, height, sides);

export const cone = (radius: number, height: number, sides = 7): Geometry =>
  new THREE.ConeGeometry(radius, height, sides);

export const capsule = (radius: number, length: number): Geometry =>
  new THREE.CapsuleGeometry(radius, length, 3, 9);

export const torus = (radius: number, tube: number, arc = Math.PI * 2): Geometry =>
  new THREE.TorusGeometry(radius, tube, 6, radius > 0.3 ? 18 : 12, arc);

export const gem = (radius: number): Geometry => new THREE.OctahedronGeometry(radius, 0);

export function crystal(radius: number, height: number): Geometry {
  const shaft = new THREE.CylinderGeometry(radius * 0.75, radius, height * 0.7, 6).toNonIndexed();
  const tip = new THREE.ConeGeometry(radius * 0.75, height * 0.3, 6).toNonIndexed();
  tip.translate(0, height * 0.5, 0);
  shaft.deleteAttribute('uv');
  tip.deleteAttribute('uv');
  const geometry = mergeGeometries([shaft, tip])!;
  geometry.computeVertexNormals();
  return geometry;
}

// --- organic shapes
/** A lump of stone, leaf or flesh. `roughness` distorts it and `seed` picks which way. */
export function blob(radius: number, roughness = 0.15, seed = 0): Geometry {
  const detail = radius < 0.1 ? 0 : radius < 0.3 ? 1 : radius < 0.9 ? 2 : 3;
  const geometry = new THREE.IcosahedronGeometry(radius, detail);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).normalize();
    const broad = noise(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed);
    const fine = noise(v.x * 5 - seed, v.y * 5 + seed, v.z * 5);
    v.multiplyScalar(radius * (1 + roughness * (broad + 0.5 * fine)));
    position.setXYZ(i, v.x, v.y, v.z);
  }
  return geometry;
}

/** A tube along a curve whose radius goes from `start` to `end`. */
export function taper(
  points: V3[],
  start: number,
  end: number,
  sides = 7,
  segments = Math.max(2, (points.length - 1) * 3),
): Geometry {
  const around = start > 0.22 ? 10 : sides;
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const geometry = new THREE.TubeGeometry(curve, segments, 1, around);
  const position = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const centre = curve.getPointAt(i / segments);
    const radius = start + (end - start) * (i / segments);
    for (let j = 0; j <= around; j++) {
      const index = i * (around + 1) + j;
      v.fromBufferAttribute(position, index).sub(centre).multiplyScalar(radius).add(centre);
      position.setXYZ(index, v.x, v.y, v.z);
    }
  }
  geometry.deleteAttribute('uv');
  return geometry;
}

/** A bevelled plate cut from a 2D outline, centred in depth. */
export function plate(draw: (outline: THREE.Shape) => void, depth: number, bevel = 0.015): Geometry {
  const outline = new THREE.Shape();
  draw(outline);
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/** A surface of revolution from [radius, y] pairs, listed in either direction. */
export function lathe(profile: [radius: number, y: number][], sides = 12): Geometry {
  const outward = signedArea(profile) < 0 ? [...profile].reverse() : profile;
  return new THREE.LatheGeometry(
    outward.map(([radius, y]) => new THREE.Vector2(Math.max(0.001, radius), y)),
    sides,
  );
}

/** Negative when the profile would turn the surface inside out. */
function signedArea(profile: [number, number][]): number {
  const loop: [number, number][] = [...profile, [0, profile.at(-1)![1]], [0, profile[0][1]]];
  return loop.reduce((area, [r, y], i) => {
    const [nextR, nextY] = loop[(i + 1) % loop.length];
    return area + r * nextY - nextR * y;
  }, 0);
}

/** Bends a whole shape sideways as it rises. */
export function bend(geometry: Geometry, amount: number): Geometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const strength = amount * Math.min(1, y);
    position.setX(i, position.getX(i) + Math.sin(y * 1.1) * strength);
    position.setZ(i, position.getZ(i) + Math.sin(y * 1.1 * 0.7 + 1) * strength * 0.5);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// --- sculpted tubes
/** An elliptical cross-section: height, radii, and how far its centre is moved. */
export type Ring = [y: number, radiusX: number, radiusZ: number, offsetZ?: number, offsetX?: number];
/** Scales a vertex by its angle (0 is +x, PI/2 is the front) and its ring's index. */
export type RingShape = (angle: number, ringIndex: number) => number;

const round: RingShape = () => 1;

/** Rings joined into a tube, capped at both ends. */
export function loft(rings: Ring[], sides = 10, shape: RingShape = round): Geometry {
  const ascending = rings[0][0] < rings.at(-1)![0];
  const stacked = ascending ? rings : [...rings].reverse();
  const originalIndex = (i: number) => (ascending ? i : rings.length - 1 - i);
  const vertex = (i: number, side: number): V3 => {
    const [y, radiusX, radiusZ, offsetZ = 0, offsetX = 0] = stacked[i];
    const angle = ((side % sides) / sides) * Math.PI * 2 + Math.PI / sides;
    const factor = shape(angle, originalIndex(i));
    return [Math.cos(angle) * radiusX * factor + offsetX, y, Math.sin(angle) * radiusZ * factor + offsetZ];
  };
  const positions: number[] = [];
  const triangle = (...corners: V3[]) => {
    for (const corner of corners) positions.push(...corner);
  };
  for (let i = 0; i < stacked.length - 1; i++)
    for (let side = 0; side < sides; side++) {
      const a = vertex(i, side);
      const b = vertex(i, side + 1);
      const c = vertex(i + 1, side);
      const d = vertex(i + 1, side + 1);
      // Alternating diagonals keep the facets from lining up.
      if ((i + side) % 2) triangle(a, c, b, b, c, d);
      else triangle(a, c, d, a, d, b);
    }
  for (const end of [0, stacked.length - 1]) {
    const [y, , , offsetZ = 0, offsetX = 0] = stacked[end];
    const centre: V3 = [offsetX, y, offsetZ];
    for (let side = 0; side < sides; side++) {
      const a = vertex(end, side);
      const b = vertex(end, side + 1);
      if (end) triangle(centre, b, a);
      else triangle(centre, a, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A loft whose profile is curved between the given rings. */
export function sculpt(rings: Ring[], sides = 14, shape: RingShape = round): Geometry {
  const full = rings.map(([y, x, z, offsetZ = 0, offsetX = 0]) => [y, x, z, offsetZ, offsetX]);
  const curved: Ring[] = [];
  for (const [i, ring] of full.entries()) {
    curved.push(ring as Ring);
    const next = full[i + 1];
    if (!next) break;
    const before = full[Math.max(0, i - 1)];
    const after = full[Math.min(full.length - 1, i + 2)];
    const between = ring.map((value, k) =>
      k === 0 ? (value + next[0]) / 2 : (9 * (value + next[k]) - before[k] - after[k]) / 16,
    );
    curved.push(between as Ring);
  }
  // A ring in between takes the average shape of its neighbours.
  const blended: RingShape = (angle, i) =>
    (shape(angle, Math.floor(i / 2)) + shape(angle, Math.ceil(i / 2))) / 2;
  return loft(curved, sides, blended);
}
