import { MONSTERS, type MonsterDef } from '@driftwake/shared';
import * as THREE from 'three';
import type { Model } from '../model';
import { beast } from './beast';
import { bird } from './bird';
import { crab } from './crab';
import { golem } from './golem';
import { plant } from './plant';
import type { MonsterShape } from './shape';
import { treant } from './treant';
import { wisp } from './wisp';

const SHAPES: Record<MonsterDef['shape'], (monster: MonsterDef) => MonsterShape> = {
  beast,
  bird,
  wisp,
  plant,
  golem,
  crab,
  treant,
};

export function monsterModel(type: string): Model {
  const monster = MONSTERS[type];
  const { parts, height, scale = 1 } = SHAPES[monster.shape](monster);
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  for (const joint of Object.values(parts)) if (!joint.parent) root.add(joint);
  return { root, parts, height, kind: monster.shape };
}
