// Building blocks shared by all models.
import * as THREE from 'three';
import { MAT } from '../geo';

export type Geometry = THREE.BufferGeometry;
export interface Model {
  root: THREE.Group;
  /** Joints by name, for the animations to move. */
  parts: Record<string, THREE.Object3D>;
  /** Height of the name tag above the ground. */
  height: number;
  /** Which animations apply: a monster's shape, or "player", "drop", "grave". */
  kind: string;
  /** Players only: changes when the model has to be rebuilt. */
  key?: string;
}

export const TAU = Math.PI * 2;
/** Left and right, for mirrored parts. */
export const SIDES = [-1, 1];
/** Evenly spaced angles around a circle. */
export const ring = (count: number) => Array.from({ length: count }, (_, i) => (i / count) * TAU);

export function mesh(geometry: Geometry): THREE.Mesh {
  const result = new THREE.Mesh(geometry, MAT);
  result.castShadow = result.receiveShadow = true;
  return result;
}

/** A joint at a position, with an optional shape hanging from it. */
export function pivot(geometry: Geometry | null, x: number, y: number, z = 0): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  if (geometry) group.add(mesh(geometry));
  return group;
}
