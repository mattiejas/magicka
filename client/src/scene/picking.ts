// Finding out what is under the mouse.
import { type GameMap, groundHeight, type TilePos } from '@driftwake/shared';
import * as THREE from 'three';
import { positionOf, sizeOf, state } from '../net/state';
import type { FixedThing, Thing } from '../things';

interface Boxed {
  box: THREE.Box3;
}
/** Something that can be clicked. */
export type Pick = Thing & Boxed;
export type FixedPick = FixedThing & Boxed;

const BOX_INSET = 0.08;
/** Monsters win over things standing just in front of them. */
const MONSTER_PRIORITY = 0.6;

/** `base` is the height of the ground the thing stands on. */
export const pickBox = (x: number, y: number, size: number, height: number, base = 0) =>
  new THREE.Box3(
    new THREE.Vector3(x + BOX_INSET, base, y + BOX_INSET),
    new THREE.Vector3(x + size - BOX_INSET, base + height, y + size - BOX_INSET),
  );

/** Everything clickable that moves or comes and goes. */
export function entityPicks(map: GameMap, heightOf: (id: string) => number): Pick[] {
  const out: Pick[] = [];
  for (const track of state.entities.values()) {
    const { entity } = track;
    if (entity.kind === 'node' || entity.id === state.me) continue;
    const [x, y] = positionOf(track);
    const size = sizeOf(entity);
    const box = pickBox(x, y, size, heightOf(entity.id), groundHeight(map, x + size / 2, y + size / 2));
    out.push({ kind: 'entity', entity, box });
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
    const priority = pick.kind === 'entity' && pick.entity.kind === 'monster' ? MONSTER_PRIORITY : 0;
    found.push({ distance: hit.distanceTo(ray.origin) - priority, pick });
  }
  return found.sort((a, b) => a.distance - b.distance).map(f => f.pick);
}

/** How far along a ray the ground is looked for, and how finely. */
const SEARCH_RANGE = 90;
const SEARCH_STEP = 0.25;
const REFINEMENTS = 8;

/** The tile where a ray first meets the ground, which may be a slope or a hill in the way. Null off the map. */
export function tileOnRay(ray: THREE.Ray, map: GameMap): TilePos | null {
  const point = new THREE.Vector3();
  const above = (distance: number) => {
    ray.at(distance, point);
    return point.y - groundHeight(map, point.x, point.z);
  };
  let near = 0;
  let far = SEARCH_STEP;
  for (; far <= SEARCH_RANGE; near = far, far += SEARCH_STEP) if (above(far) <= 0) break;
  if (far > SEARCH_RANGE || above(near) < 0) return null;
  for (let i = 0; i < REFINEMENTS; i++) {
    const middle = (near + far) / 2;
    if (above(middle) > 0) near = middle;
    else far = middle;
  }
  ray.at(far, point);
  if (point.x < 0 || point.z < 0 || point.x >= map.size || point.z >= map.size) return null;
  return [Math.floor(point.x), Math.floor(point.z)];
}
