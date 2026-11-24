// Trees that have just been felled tip over, lie for a moment and sink away.
import * as THREE from 'three';
import { MAT } from '../geo';

const FALL_MS = 900;
const LIE_MS = 500;
const SINK_MS = 600;
const SINK_DEPTH = 1.6;

interface Tree {
  root: THREE.Group;
  axis: THREE.Vector3;
  startedAt: number;
}

export class FallingTrees {
  readonly group = new THREE.Group();
  private trees: Tree[] = [];

  /** The tree falls in direction (dx, dy), away from whoever felled it. */
  add(geometry: THREE.BufferGeometry, placement: THREE.Matrix4, dx: number, dy: number) {
    const mesh = new THREE.Mesh(geometry, MAT);
    mesh.castShadow = true;
    const base = new THREE.Vector3().setFromMatrixPosition(placement);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(placement).setPosition(0, 0, 0);
    const root = new THREE.Group();
    root.position.copy(base);
    root.add(mesh);
    this.group.add(root);
    const axis = dx || dy ? new THREE.Vector3(dy, 0, -dx).normalize() : new THREE.Vector3(1, 0, 0);
    this.trees.push({ root, axis, startedAt: performance.now() });
  }

  update(now: number) {
    this.trees = this.trees.filter(({ root, axis, startedAt }) => {
      const elapsed = now - startedAt;
      const fall = Math.min(1, Math.max(0, elapsed / FALL_MS));
      root.setRotationFromAxisAngle(axis, fall ** 2.4 * 1.45);
      const sink = Math.max(0, (elapsed - FALL_MS - LIE_MS) / SINK_MS);
      root.position.y = -sink * SINK_DEPTH;
      if (sink < 1) return true;
      this.group.remove(root);
      return false;
    });
  }
}
