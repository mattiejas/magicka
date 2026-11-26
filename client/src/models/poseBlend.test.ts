import { describe, expect, it } from 'vitest';
import { type Pose, posePlayer } from './animation';
import type { Model } from './model';
import { playerModel } from './player';
import { BLEND_MS, BLOW_BLEND_MS, PoseBlend } from './poseBlend';

const START = 10_000;
const SWORD = ['iron_sword', null, null, null, 'cape_mining'];
const ATTACK_MS = 550;

const pose = (sinceMs: number, more: Partial<Pose> = {}): Pose => ({
  time: START + sinceMs,
  walk: (START + sinceMs) / 105,
  moving: false,
  hit: 0,
  ...more,
});
const walking = (sinceMs: number) => pose(sinceMs, { moving: true });
const JOINTS = ['upper', 'head', 'la', 'la2', 'ra', 'ra2', 'll', 'll2', 'rl', 'rl2', 'cape'];
const anglesOf = ({ parts }: Model) =>
  JOINTS.flatMap(name => parts[name].rotation.toArray().slice(0, 3) as number[]);

function shown(...steps: Pose[]) {
  const model = playerModel('Someone', SWORD);
  const blend = new PoseBlend();
  for (const step of steps) posePlayer(model, step, blend);
  return anglesOf(model);
}
function unblended(step: Pose) {
  const model = playerModel('Someone', SWORD);
  posePlayer(model, step);
  return anglesOf(model);
}
const furthest = (a: number[], b: number[]) => Math.max(...a.map((angle, i) => Math.abs(angle - b[i])));

describe('blending between poses', () => {
  it('shows the first pose at once', () => {
    expect(shown(walking(0))).toEqual(unblended(walking(0)));
  });

  it('starts where the last pose was and ends in the new one', () => {
    expect(furthest(shown(walking(0), pose(0)), unblended(walking(0)))).toBeLessThan(1e-9);
    expect(shown(walking(0), pose(BLEND_MS))).toEqual(unblended(pose(BLEND_MS)));
  });

  it('is between both poses halfway', () => {
    const half = pose(BLEND_MS / 2);
    const arm = JOINTS.indexOf('ra') * 3;
    const [from, now, to] = [unblended(walking(0)), shown(walking(0), half), unblended(half)].map(
      a => a[arm],
    );
    expect(now).toBeCloseTo((from + to) / 2);
  });

  it('does not jump when it is interrupted', () => {
    const before = [walking(0), pose(60)];
    expect(furthest(shown(...before, walking(60)), shown(...before))).toBeLessThan(1e-9);
  });

  it('takes the time that has passed after a long pause as the end of it', () => {
    expect(shown(walking(0), pose(60_000))).toEqual(unblended(pose(60_000)));
  });

  it('keeps the timing of walking, strokes and blows', () => {
    const work = (ms: number) => pose(ms, { action: 'mine', tool: 'iron_pickaxe' });
    const blow = (ms: number) => pose(ms, { action: 'melee', hit: 1 - ms / ATTACK_MS });
    for (const at of [walking, work, blow])
      for (const ms of [20, 200, 340, 500]) expect(shown(at(0), at(ms))).toEqual(unblended(at(ms)));
  });

  it('is done with a transition before a blow that starts during it cuts down', () => {
    const blow = pose(60 + BLOW_BLEND_MS, { action: 'melee', hit: 1 - BLOW_BLEND_MS / ATTACK_MS });
    expect(shown(walking(0), pose(60, { action: 'melee' }), blow)).toEqual(unblended(blow));
  });

  it('holds a blow that is still running when the walk starts again', () => {
    const blow = (ms: number) => pose(ms, { action: 'melee', hit: 1 - ms / ATTACK_MS });
    const walkingOn = (ms: number) => pose(ms, { moving: true, hit: 1 - ms / ATTACK_MS });
    const movingBlow = (ms: number) => ({ ...blow(ms), moving: true });
    const at = 250 + BLOW_BLEND_MS;
    expect(shown(walking(-100), blow(0), blow(250), walkingOn(at))).toEqual(unblended(movingBlow(at)));
  });

  it('lets go of a blow once it is over', () => {
    const after = walking(ATTACK_MS + BLEND_MS);
    const steps = [walking(-100), pose(0, { action: 'melee', hit: 1 }), walking(ATTACK_MS)];
    expect(shown(...steps, after)).toEqual(unblended(after));
  });

  it('carries on when the model is rebuilt', () => {
    const blend = new PoseBlend();
    posePlayer(playerModel('Someone', SWORD), walking(0), blend);
    const rebuilt = playerModel('Someone', [null, 'iron_helm', null, null, 'cape_mining']);
    posePlayer(rebuilt, pose(0), blend);
    expect(furthest(anglesOf(rebuilt), unblended(walking(0)))).toBeLessThan(1e-9);
  });

  it('lifts a foot that has to go elsewhere', () => {
    const half = pose(BLEND_MS / 2, { action: 'melee' });
    const knee = JOINTS.indexOf('ll2') * 3;
    expect(shown(pose(0), half)[knee]).toBeGreaterThan(unblended(half)[knee]);
  });
});
