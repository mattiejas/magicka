// Bracketed corners on the ground: the hovered tile, the destination or course, and the tile the server has you on.
import type { TilePos } from '@driftwake/shared';
import * as THREE from 'three';

export class TileMarker {
  readonly mesh: THREE.Mesh;

  constructor(
    color: string,
    opacity: number,
    private height: number,
  ) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(outlineGeometry(), material);
    this.mesh.visible = false;
  }

  /** The outline lies on the ground, also on a slope: `groundAt` gives the height of the ground at a point. */
  show([x, y]: TilePos, groundAt: (x: number, z: number) => number) {
    this.mesh.position.set(x + 0.5, 0, y + 0.5);
    this.mesh.visible = true;
    const corners = this.mesh.geometry.attributes.position;
    for (let i = 0; i < corners.count; i++)
      corners.setY(i, this.height + groundAt(x + 0.5 + corners.getX(i), y + 0.5 + corners.getZ(i)));
    corners.needsUpdate = true;
  }

  hide() {
    this.mesh.visible = false;
  }

  isAt([x, y]: TilePos): boolean {
    return Math.hypot(x + 0.5 - this.mesh.position.x, y + 0.5 - this.mesh.position.z) < 0.1;
  }
}

/** Half a tile, less a sliver so neighbouring markers do not touch. */
const EDGE = 0.47;
const ARM = 0.15;
const THICKNESS = 0.03;

/** A bracket in each corner of the tile. */
function outlineGeometry(): THREE.BufferGeometry {
  const corners = [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sx, sz]) => {
    const at = (x: number, z: number) => new THREE.Vector2(sx * x, sz * z);
    return new THREE.Shape([
      at(EDGE, EDGE),
      at(EDGE - ARM, EDGE),
      at(EDGE - ARM, EDGE - THICKNESS),
      at(EDGE - THICKNESS, EDGE - THICKNESS),
      at(EDGE - THICKNESS, EDGE - ARM),
      at(EDGE, EDGE - ARM),
    ]);
  });
  return new THREE.ShapeGeometry(corners).rotateX(-Math.PI / 2);
}
