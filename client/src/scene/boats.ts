// Boats on the water: every player's on this map, sailed or moored, and for the player aboard, where theirs goes.
import * as THREE from 'three';
import { MAT } from '../geo';
import { boatGeo, SAIL_SETTINGS } from '../models';
import { boatAt, state } from '../net/state';
import { WATER_LEVEL } from './worldView';

/** Boats are a little smaller than the one being built at the dock, so that a turn of 3 tiles looks right. */
const BOAT_SCALE = 0.8;
/** How far the boat rocks on the water, in world units and radians, and how slowly. */
const BOB = 0.035;
const ROLL = 0.035;
const BOB_MS = 900;
const ARC_HEIGHT = 0.04;

/** One finished boat for each sail setting, shared by every boat that shows it. */
let geometries: THREE.BufferGeometry[] | null = null;
const geometryFor = (setting: number) => {
  geometries ??= SAIL_SETTINGS.map((_, i) => boatGeo(() => 1, i));
  return geometries[setting] ?? geometries[1];
};

export class Boats {
  readonly group = new THREE.Group();
  private meshes = new Map<string, THREE.Mesh>();
  private arc = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineDashedMaterial({
      color: '#f3ecdc',
      dashSize: 0.3,
      gapSize: 0.45,
      transparent: true,
      opacity: 0.55,
    }),
  );

  constructor() {
    this.arc.frustumCulled = false;
    this.group.add(this.arc);
  }

  /** `inSight` tells whether a point can be seen, which at sea is only within the lookout. */
  update(now: number, inSight: (x: number, y: number) => boolean) {
    const shown = new Set<string>();
    for (const track of state.entities.values()) {
      const at = boatAt(track);
      if (!at || !inSight(at.x, at.y)) continue;
      const { id, boat } = track.entity;
      shown.add(id);
      const mesh = this.meshFor(id);
      mesh.geometry = geometryFor(boat!.sail);
      const phase = now / BOB_MS + id.length + Number(id) * 0.37;
      mesh.position.set(at.x, WATER_LEVEL + Math.sin(phase) * BOB, at.y);
      mesh.rotation.set(
        Math.sin(phase * 0.8) * ROLL * 0.5,
        (-at.heading * Math.PI) / 180,
        Math.cos(phase) * ROLL,
        'YXZ',
      );
    }
    for (const [id, mesh] of this.meshes)
      if (!shown.has(id)) {
        this.group.remove(mesh);
        this.meshes.delete(id);
      }
    this.updateArc();
  }

  clear() {
    for (const mesh of this.meshes.values()) this.group.remove(mesh);
    this.meshes.clear();
  }

  private meshFor(id: string): THREE.Mesh {
    let mesh = this.meshes.get(id);
    if (!mesh) {
      mesh = new THREE.Mesh(geometryFor(1), MAT);
      mesh.scale.setScalar(BOAT_SCALE);
      mesh.castShadow = true;
      this.meshes.set(id, mesh);
      this.group.add(mesh);
    }
    return mesh;
  }

  /** The dashed arc the boat will follow over the next ticks, from where it is drawn now. */
  private updateArc() {
    const { voyage } = state;
    const mine = state.entities.get(state.me);
    const at = mine && boatAt(mine);
    this.arc.visible = !!voyage && !!at && voyage.ahead.length > 0;
    if (!this.arc.visible) return;
    const { x, y } = mine!.entity.boat!;
    const points = [[at!.x, at!.y], [x, y], ...voyage!.ahead].map(
      ([px, py]) => new THREE.Vector3(px, WATER_LEVEL + ARC_HEIGHT, py),
    );
    this.arc.geometry.setFromPoints(points);
    this.arc.computeLineDistances();
  }
}
