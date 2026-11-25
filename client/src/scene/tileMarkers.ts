// Outlined squares on the ground: the hovered tile, the destination, and the tile the server has you on.
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

function outlineGeometry(): THREE.BufferGeometry {
  const outer = 0.48;
  const inner = 0.41;
  const shape = new THREE.Shape();
  shape.moveTo(-outer, -outer).lineTo(outer, -outer).lineTo(outer, outer).lineTo(-outer, outer);
  const hole = new THREE.Path();
  hole.moveTo(-inner, -inner).lineTo(-inner, inner).lineTo(inner, inner).lineTo(inner, -inner);
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}
