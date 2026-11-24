// Posing models. Every function sets all joints it uses, so poses never depend on the frame before.
import { type BossView, ITEMS } from '@magicka/shared';
import type * as THREE from 'three';
import { heldGeo } from './held';
import { type Model, mesh, TAU } from './model';
import { HIP } from './player/plan';

export interface Pose {
  action?: string;
  /** Phase of the walk cycle. */
  walk: number;
  moving: boolean;
  /** Runs from 1 to 0 after an attack. */
  hit: number;
  /** Milliseconds. */
  time: number;
  /** Item id of the tool being worked with. */
  tool?: string;
}

const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// --- work
const WORK_CYCLE_MS: Record<string, number> = { mine: 1200, chop: 1200, craft: 750 };
/** Length of one stroke, or 0 for actions without one. */
export const workCycleMs = (action: string) => WORK_CYCLE_MS[action] ?? 0;
/** Point in a stroke at which the tool lands. */
export const STRIKE_AT = 0.7;
const LIFT_UNTIL = 0.55;

/** 1 is fully raised, 0 is resting on the target: a slow lift, a fast strike, a short rest. */
function swing(progress: number): number {
  if (progress < LIFT_UNTIL) return ease(progress / LIFT_UNTIL);
  if (progress < STRIKE_AT) return 1 - ((progress - LIFT_UNTIL) / (STRIKE_AT - LIFT_UNTIL)) ** 2;
  return 0;
}
const strokeAt = ({ action, time }: Pose) => {
  const cycle = workCycleMs(action!);
  return swing((time % cycle) / cycle);
};

// --- players
/** Joint angles of a player, in radians. Arms and legs: shoulder or hip, then elbow or knee. */
interface PlayerJoints {
  lean: number;
  twist: number;
  nod: number;
  leftArm: number;
  leftElbow: number;
  leftSpread: number;
  rightArm: number;
  rightElbow: number;
  rightSpread: number;
  leftLeg: number;
  leftKnee: number;
  rightLeg: number;
  rightKnee: number;
  /** Change in hip height. */
  drop: number;
}

function standing({ time }: Pose): PlayerJoints {
  return {
    lean: Math.sin(time / 700) * 0.012, // breathing
    twist: 0,
    nod: 0,
    leftArm: 0,
    leftElbow: -0.26,
    leftSpread: 0.15,
    rightArm: 0,
    rightElbow: -0.26,
    rightSpread: -0.15,
    leftLeg: 0,
    leftKnee: 0,
    rightLeg: 0,
    rightKnee: 0,
    drop: 0,
  };
}

function walking(pose: Pose): PlayerJoints {
  const stride = Math.sin(pose.walk);
  const kneeBend = Math.sin(pose.walk + 0.9);
  return {
    ...standing(pose),
    lean: 0.08,
    twist: -stride * 0.12,
    leftArm: -stride * 0.6,
    rightArm: stride * 0.6,
    leftLeg: stride * 0.75,
    rightLeg: -stride * 0.75,
    leftKnee: Math.max(0, -kneeBend) * 0.9 + 0.1,
    rightKnee: Math.max(0, kneeBend) * 0.9 + 0.1,
    drop: Math.abs(Math.cos(pose.walk)) * 0.035,
  };
}

/** Feet apart, ready to work or fight. */
const STANCE = { leftLeg: -0.3, rightLeg: 0.26, leftKnee: 0.2, rightKnee: 0.1, drop: -0.03 };

type ActionPose = (pose: Pose, base: PlayerJoints) => Partial<PlayerJoints>;

const overheadStroke =
  (twistDown: number, twistUp: number): ActionPose =>
  pose => {
    const raised = strokeAt(pose);
    return {
      ...(pose.moving ? {} : STANCE),
      lean: mix(0.34, -0.14, raised),
      nod: mix(0, 0.1, raised),
      twist: mix(twistDown, twistUp, raised),
      rightArm: mix(-1.0, -2.35, raised),
      rightElbow: mix(-0.15, -0.75, raised),
      rightSpread: 0.16,
      leftArm: mix(-1.15, -2.1, raised),
      leftElbow: mix(-0.35, -0.95, raised),
      leftSpread: -0.5,
    };
  };

const hammering: ActionPose = pose => {
  const raised = strokeAt(pose);
  return {
    lean: 0.18,
    nod: 0.2,
    rightArm: mix(-0.7, -1.5, raised),
    rightElbow: mix(-0.3, -0.9, raised),
    leftArm: -0.75,
    leftElbow: -0.5,
    leftSpread: -0.1,
  };
};

const picking: ActionPose = ({ time }) => {
  const reach = Math.sin(time / 260) * 0.2;
  return {
    lean: 0.72,
    nod: 0.1,
    leftLeg: -0.5,
    rightLeg: 0.1,
    leftKnee: 0.8,
    rightKnee: 0.6,
    drop: -0.13,
    leftArm: -0.95 + reach,
    rightArm: -0.95 - reach,
    leftElbow: -0.3,
    rightElbow: -0.3,
  };
};

const eating: ActionPose = ({ time }) => ({
  rightArm: -1.2,
  rightElbow: -1.7 + Math.sin(time / 90) * 0.12,
  rightSpread: 0.3,
  nod: 0.12,
});

const shooting: ActionPose = ({ hit, moving }) => ({
  ...(moving ? {} : STANCE),
  twist: 0.55,
  leftArm: -1.5,
  leftElbow: -0.06,
  leftSpread: -0.45,
  rightArm: -1.45,
  // Draws the string back again after a shot.
  rightElbow: mix(-0.7, -1.9, ease(Math.min(1, (1 - hit) * 1.6))),
  rightSpread: -0.35,
});

const casting: ActionPose = ({ hit, moving }) => ({
  ...(moving ? {} : STANCE),
  rightArm: mix(-1.25, -1.75, hit),
  rightElbow: mix(-0.5, -0.05, hit),
  leftArm: mix(-0.5, -1.6, hit),
  leftElbow: mix(-0.7, -0.15, hit),
  lean: hit * 0.14,
});

const GUARD = { rightArm: -0.7, rightElbow: -0.75, leftArm: -0.5, leftElbow: -0.9 };

const slashing: ActionPose = ({ hit, moving }, base) => {
  const guard = { ...(moving ? {} : STANCE), ...GUARD };
  if (hit <= 0) return guard;
  const progress = 1 - hit;
  const through = (rest: number, raised: number, down: number) => slash(progress, rest, raised, down);
  return {
    ...guard,
    rightArm: through(GUARD.rightArm, -2.5, -0.45),
    rightElbow: through(GUARD.rightElbow, -0.8, 0),
    twist: through(0, 0.4, -0.45),
    lean: through(base.lean, -0.08, 0.26),
    leftArm: through(GUARD.leftArm, -0.8, 0.2),
    nod: through(0, 0.05, 0.1),
  };
};

/** Wind up, cut down fast, hold, then return to guard. */
function slash(progress: number, rest: number, raised: number, down: number): number {
  if (progress < 0.3) return mix(rest, raised, ease(progress / 0.3));
  if (progress < 0.5) return mix(raised, down, ((progress - 0.3) / 0.2) ** 2);
  if (progress < 0.75) return down;
  return mix(down, rest, ease((progress - 0.75) / 0.25));
}

const ACTIONS: Record<string, ActionPose> = {
  mine: overheadStroke(-0.05, 0.12),
  chop: overheadStroke(-0.25, 0.5),
  craft: hammering,
  pick: picking,
  eat: eating,
  ranged: shooting,
  magic: casting,
  melee: slashing,
};

export function posePlayer(model: Model, pose: Pose) {
  const base = pose.moving ? walking(pose) : standing(pose);
  const joints = { ...base, ...ACTIONS[pose.action ?? '']?.(pose, base) };
  applyJoints(model.parts, joints, pose.moving);
  holdTool(model.parts, pose);
}

function applyJoints(parts: Model['parts'], j: PlayerJoints, moving: boolean) {
  const hip = HIP + j.drop;
  parts.upper.rotation.set(j.lean, j.twist, 0);
  parts.upper.position.y = parts.hips.position.y = hip;
  parts.hips.rotation.set(j.lean * 0.45, j.twist * 0.3, 0);
  parts.head.rotation.set(j.nod - j.lean * 0.6, -j.twist * 0.7, 0);
  parts.la.rotation.set(j.leftArm, 0, j.leftSpread);
  parts.ra.rotation.set(j.rightArm, 0, j.rightSpread);
  parts.la2.rotation.x = j.leftElbow;
  parts.ra2.rotation.x = j.rightElbow;
  const legSpread = moving ? 0.015 : 0.055;
  parts.ll.rotation.set(j.leftLeg, 0, legSpread);
  parts.rl.rotation.set(j.rightLeg, 0, -legSpread);
  parts.ll2.rotation.x = j.leftKnee;
  parts.rl2.rotation.x = j.rightKnee;
  parts.ll.position.y = parts.rl.position.y = hip;
}

const HAMMER = 'hammer';

function toolFor({ action, tool }: Pose): string | undefined {
  if (action === 'mine' || action === 'chop') return tool;
  return action === 'craft' ? HAMMER : undefined;
}

/** Puts the right tool in hand, and hides the weapon while both hands are busy. */
function holdTool(parts: Model['parts'], pose: Pose) {
  const wanted = toolFor(pose);
  if (parts.tool?.userData.id !== wanted) {
    if (parts.tool) {
      parts.rah.remove(parts.tool);
      (parts.tool as THREE.Mesh).geometry.dispose();
      delete parts.tool;
    }
    if (wanted) parts.tool = createTool(wanted, parts.rah);
  }
  const handsBusy = wanted || pose.action === 'pick' || pose.action === 'eat';
  if (parts.weapon) parts.weapon.visible = !handsBusy;
}

function createTool(id: string, hand: THREE.Object3D): THREE.Mesh {
  const item = ITEMS[id];
  const tool = mesh(heldGeo(item?.icon ?? HAMMER, item?.color ?? '#6b7177'));
  tool.userData.id = id;
  tool.scale.setScalar(1.1);
  tool.rotation.x = id === HAMMER ? 1.75 : 2.1;
  hand.add(tool);
  return tool;
}

// --- monsters
type MonsterPose = Pose & {
  /** Keeps neighbours from moving in step. */
  phase: number;
};

const MONSTER_POSES: Record<string, (parts: Model['parts'], pose: MonsterPose, stride: number) => void> = {
  wisp(parts, { time, hit, phase }) {
    parts.body.position.y = 1.05 + Math.sin(time / 450 + phase) * 0.12;
    parts.body.rotation.x = hit * 0.5;
    for (let i = 0; i < 3; i++) {
      const angle = time / 700 + (i * TAU) / 3;
      parts[`shard${i}`].position.set(
        Math.cos(angle) * 0.45,
        0.1 + Math.sin(angle * 2) * 0.12,
        Math.sin(angle) * 0.45,
      );
    }
  },
  plant(parts, { time, hit, phase }) {
    parts.body.rotation.set(Math.sin(hit * Math.PI) * 0.35, 0, Math.sin(time / 600 + phase) * 0.05);
  },
  golem(parts, { hit }, stride) {
    const blow = Math.sin(hit * Math.PI);
    parts.la.rotation.x = -stride;
    parts.ra.rotation.x = stride - blow * 2;
    parts.body.rotation.x = blow * 0.2;
  },
  beast(parts, { time, hit, phase }) {
    const lunge = Math.sin(hit * Math.PI);
    parts.head.rotation.x = Math.sin(time / 600 + phase) * 0.05 + lunge * 0.45;
    parts.body.rotation.x = -lunge * 0.08;
    if (parts.leftWing) {
      parts.leftWing.rotation.z = 0.25 + Math.sin(time / 220) * 0.3;
      parts.rightWing.rotation.z = -parts.leftWing.rotation.z;
    }
  },
};

export function poseMonster(model: Model, pose: MonsterPose) {
  const { parts, kind } = model;
  const stride = pose.moving ? Math.sin(pose.walk) * 0.65 : 0;
  for (const leg of [parts.ll, parts.lb]) if (leg) leg.rotation.x = stride;
  for (const leg of [parts.rl, parts.rb]) if (leg) leg.rotation.x = -stride;
  MONSTER_POSES[kind]?.(parts, pose, stride);
}

// --- bosses
/** How far each arm is raised by the end of a wind-up, as [left, right]. */
const BOSS_ARMS: Record<string, [left: number, right: number]> = { melee: [0, 1], vines: [0.4, 0.4] };
const BOTH_ARMS: [number, number] = [1, 1];

/** `progress` runs from 0 to 1 through the wind-up, then again through the execution. */
export function poseBoss({ parts, kind }: Model, boss: BossView, progress: number) {
  const isCrab = kind === 'crab';
  let left = 0;
  let right = 0;
  let tilt = Math.sin(performance.now() / 900) * 0.02;
  if (boss.state === 'windup') {
    const [leftLift, rightLift] = BOSS_ARMS[boss.attack!] ?? BOTH_ARMS;
    left = -leftLift * progress * (isCrab ? 0.9 : 2.6);
    right = -rightLift * progress * (isCrab ? 1.1 : 2.6);
    tilt -= progress * 0.12;
    if (boss.attack === 'vines' && !isCrab) left = right = 0.5 * progress; // reaches into the ground
  } else if (boss.state === 'execute') {
    const recoil = Math.max(0, 1 - progress * 2);
    left = boss.attack === 'melee' ? 0 : -recoil;
    right = -recoil;
    tilt += recoil * 0.22;
  }
  parts.la.rotation.x = left;
  parts.ra.rotation.x = right;
  parts.body.rotation.x = tilt;
}
