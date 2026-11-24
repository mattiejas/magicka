// Player characters: a sculpted body with equipment layered on top.
import { defaultLook, type Item, type Look } from '@driftwake/shared';
import * as THREE from 'three';
import { merge } from '../../geo';
import { heldGeo } from '../held';
import { type Model, mesh, pivot } from '../model';
import { addArm } from './arms';
import { headJoint } from './head';
import { addLeg } from './legs';
import { outfitOf } from './outfit';
import { HIP } from './plan';
import { hipJoint, torso } from './torso';

/** Changes whenever a player's model has to be rebuilt. */
export const modelKey = (gear: (string | null)[], look: Look) => `${gear.join()}|${look.cut}|${look.color}`;

export function playerModel(name: string, gear: (string | null)[], look: Look = defaultLook(name)): Model {
  const outfit = outfitOf(name, gear, look);
  const root = new THREE.Group();
  const upper = pivot(null, 0, HIP);
  const hips = hipJoint(outfit);
  const parts: Model['parts'] = {
    upper,
    hips,
    body: pivot(merge(torso(outfit)), 0, 0),
    head: headJoint(outfit),
  };
  root.add(hips);
  addArm(parts, 'la', 1, outfit);
  addArm(parts, 'ra', -1, outfit);
  upper.add(parts.body, parts.head);
  addLeg(parts, root, 'll', 1, outfit);
  addLeg(parts, root, 'rl', -1, outfit);
  root.add(upper);
  if (outfit.weapon) parts.weapon = addWeapon(parts, outfit.weapon);
  return { root, parts, height: 1.85, kind: 'player', key: modelKey(gear, look) };
}

function addWeapon(parts: Model['parts'], { icon, color, unique }: Item): THREE.Mesh {
  const weapon = mesh(heldGeo(icon, color, unique));
  weapon.scale.setScalar(1.1);
  if (icon === 'bow') {
    weapon.rotation.x = Math.PI / 2 - 0.05;
    parts.lah.add(weapon);
  } else {
    weapon.rotation.x = 1.5;
    parts.rah.add(weapon);
  }
  return weapon;
}
