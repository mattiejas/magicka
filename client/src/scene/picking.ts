// Finding out what is under the mouse.
import { type Entity, ITEMS, MONSTERS, type TilePos } from '@driftwake/shared';
import * as THREE from 'three';
import { positionOf, sizeOf, state } from '../net/state';

/** Something that can be clicked. */
export interface Pick {
  kind: 'node' | 'station' | 'entity';
  id: string;
  name: string;
  /** Node, station, monster or item id. */
  type: string;
  box: THREE.Box3;
  entity?: Entity;
}

const BOX_INSET = 0.08;
/** Monsters win over things standing just in front of them. */
const MONSTER_PRIORITY = 0.6;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export const pickBox = (x: number, y: number, size: number, height: number) =>
  new THREE.Box3(
    new THREE.Vector3(x + BOX_INSET, 0, y + BOX_INSET),
    new THREE.Vector3(x + size - BOX_INSET, height, y + size - BOX_INSET),
  );

function entityName(entity: Entity): string {
  switch (entity.kind) {
    case 'monster':
      return MONSTERS[entity.type!].name;
    case 'drop':
      return ITEMS[entity.type!].name + (entity.qty! > 1 ? ` (${entity.qty})` : '');
    case 'grave':
      return 'Your grave';
    default:
      return entity.name ?? '';
  }
}

/** Everything clickable that moves or comes and goes. */
export function entityPicks(heightOf: (id: string) => number): Pick[] {
  const out: Pick[] = [];
  for (const track of state.entities.values()) {
    const { entity } = track;
    if (entity.kind === 'node' || entity.id === state.me) continue;
    const [x, y] = positionOf(track);
    const box = pickBox(x, y, sizeOf(entity), heightOf(entity.id));
    out.push({
      kind: 'entity',
      id: entity.id,
      name: entityName(entity),
      type: entity.type ?? '',
      box,
      entity,
    });
  }
  return out;
}

export function rayAt(mouseX: number, mouseY: number, camera: THREE.Camera): THREE.Ray {
  const caster = new THREE.Raycaster();
  const pointer = new THREE.Vector2((mouseX / innerWidth) * 2 - 1, 1 - (mouseY / innerHeight) * 2);
  caster.setFromCamera(pointer, camera);
  return caster.ray;
}

/** The picks a ray passes through, nearest first. */
export function picksOnRay(ray: THREE.Ray, picks: Pick[]): Pick[] {
  const hit = new THREE.Vector3();
  const found: { distance: number; pick: Pick }[] = [];
  for (const pick of picks) {
    if (!ray.intersectBox(pick.box, hit)) continue;
    const priority = pick.entity?.kind === 'monster' ? MONSTER_PRIORITY : 0;
    found.push({ distance: hit.distanceTo(ray.origin) - priority, pick });
  }
  return found.sort((a, b) => a.distance - b.distance).map(f => f.pick);
}

/** The tile where a ray meets the ground, if that is on the map. */
export function tileOnRay(ray: THREE.Ray, mapSize: number): TilePos | null {
  const point = ray.intersectPlane(GROUND, new THREE.Vector3());
  if (!point || point.x < 0 || point.z < 0 || point.x >= mapSize || point.z >= mapSize) return null;
  return [Math.floor(point.x), Math.floor(point.z)];
}
