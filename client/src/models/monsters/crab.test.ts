import type { BossView } from '@driftwake/shared';
import { MONSTERS } from '@driftwake/shared';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { poseBoss } from '../animation';
import { monsterModel } from '.';

const boss = (state: BossView['state'], attack: string, end = 4): BossView => ({
  state,
  attack,
  tiles: [[0, 0]],
  centres: [[0, 0]],
  start: state === 'execute' ? end : 1,
  end: state === 'execute' ? end + 2 : end,
});
const fingers = (view: BossView, progress: number) => {
  const model = monsterModel('gnashclaw');
  poseBoss(model, view, progress);
  const opening = ({ rotation }: THREE.Object3D) => Math.abs(rotation.y);
  return [opening(model.parts.leftFinger), opening(model.parts.rightFinger)].sort((a, b) => b - a);
};

it('keeps its legs and shell within its tiles, whichever way it turns and leans', () => {
  for (const [state, attack, progress] of [
    ['choose', 'snap', 0],
    ['windup', 'jet', 1],
    ['execute', 'jet', 0],
  ] as const) {
    const { root, parts } = monsterModel('gnashclaw');
    poseBoss({ root, parts, height: 0, kind: 'crab' }, boss(state, attack), progress);
    root.updateMatrixWorld(true);
    let widest = 0;
    const at = new THREE.Vector3();
    parts.body.traverse(object => {
      const points = (object as THREE.Mesh).geometry?.getAttribute('position');
      for (let i = 0; i < (points?.count ?? 0); i++) {
        at.fromBufferAttribute(points, i).applyMatrix4(object.matrixWorld);
        widest = Math.max(widest, Math.hypot(at.x, at.z));
      }
    });
    expect(widest).toBeLessThanOrEqual(MONSTERS.gnashclaw.size / 2);
  }
});

it('opens one claw for a snap and both for a double snap, and shuts them when it lands', () => {
  const idle = fingers(boss('choose', 'snap'), 0);
  const snap = fingers(boss('windup', 'snap'), 1);
  expect(snap[0]).toBeGreaterThan(0.8);
  expect(snap[1]).toBeCloseTo(idle[1], 1);
  expect(Math.min(...fingers(boss('windup', 'double_snap'), 1))).toBeGreaterThan(0.8);
  // Still open as it lands, and shut soon after.
  expect(Math.min(...fingers(boss('execute', 'double_snap'), 0))).toBeGreaterThan(0.8);
  expect(Math.max(...fingers(boss('execute', 'double_snap'), 0.15))).toBe(0);
});

it('snaps with the claw it opened', () => {
  for (const end of [4, 5]) {
    const at = (state: BossView['state']) => {
      const model = monsterModel('gnashclaw');
      poseBoss(model, boss(state, 'snap', end), state === 'windup' ? 1 : 0);
      return Math.abs(model.parts.leftFinger.rotation.y) > 0.8;
    };
    expect(at('windup')).toBe(at('execute'));
  }
});
