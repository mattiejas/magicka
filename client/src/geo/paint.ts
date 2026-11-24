// Colouring: every part is non-indexed with baked vertex colours, so parts can be merged into one mesh.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];

export const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });

/** Edges shallower than this many radians are blended; anything steeper stays a crisp facet. */
const CREASE_ANGLE = 0.17;
const WARM = new THREE.Color('#ffe2a0');
const COOL = new THREE.Color('#6a4258');

/** Smooth pseudo-noise in -1..1. */
export const noise = (x: number, y: number, z: number) =>
  (Math.sin(x * 1.7 + y * 2.3 + 1.1) +
    Math.sin(y * 1.9 - z * 2.7 + 2.3) +
    Math.sin(z * 1.3 + x * 2.9 + 4.2)) /
  3;

/** Multiplies a colour's brightness. */
export const shade = (color: string, factor: number) =>
  `#${new THREE.Color(color).multiplyScalar(factor).getHexString()}`;

export const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(parts)!;

/** Places, colours and facets a shape, ready to be merged with others. */
export function part(
  shape: THREE.BufferGeometry,
  color: string,
  position: V3 = [0, 0, 0],
  rotation: V3 = [0, 0, 0],
  scale: V3 | number = 1,
): THREE.BufferGeometry {
  const geometry = shape.index ? shape.toNonIndexed() : shape.clone();
  for (const name of Object.keys(geometry.attributes))
    if (name !== 'position') geometry.deleteAttribute(name);
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale),
    ),
  );
  geometry.computeVertexNormals();
  geometry.setAttribute('normal', toCreasedNormals(geometry, CREASE_ANGLE).attributes.normal);
  paint(geometry, new THREE.Color(color));
  return geometry;
}

/** Painted light: faces looking up drift warm, faces looking down and low parts drift plum. */
function paint(geometry: THREE.BufferGeometry, color: THREE.Color) {
  const { position, normal } = geometry.attributes;
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox!;
  const height = Math.max(0.001, max.y - min.y);
  const colors = new Float32Array(position.count * 3);
  for (let face = 0; face < position.count; face += 3) {
    const [x, y, z] = faceCentre(position, face);
    const facing = normal.getY(face);
    const faceColor = color.clone().multiplyScalar(1 + noise(x * 23, y * 19, z * 23) * 0.065);
    if (facing > 0) faceColor.lerp(WARM, facing * 0.08);
    else faceColor.lerp(COOL, -facing * 0.2);
    faceColor.lerp(COOL, 0.1 * (1 - (y - min.y) / height) ** 2);
    for (let vertex = 0; vertex < 3; vertex++) faceColor.toArray(colors, (face + vertex) * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

function faceCentre(position: Attribute, face: number): V3 {
  const mean = (axis: number) =>
    (position.getComponent(face, axis) +
      position.getComponent(face + 1, axis) +
      position.getComponent(face + 2, axis)) /
    3;
  return [mean(0), mean(1), mean(2)];
}
