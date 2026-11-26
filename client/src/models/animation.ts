// Posing models. Poses depend on the moment alone and every function sets all joints it uses. Only a
// player's `PoseBlend` remembers the frame before, to mix one pose into the next.
import { type BossView, ITEMS } from '@driftwake/shared';
import type * as THREE from 'three';
import { heldGeo } from './held';
import { type Model, mesh, TAU } from './model';
import { CLAW_JOINT } from './monsters/crab';
import { HIP } from './player/plan';
import type { PoseBlend } from './poseBlend';

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

export const ease = (t: number) => t * t * (3 - 2 * t);
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

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
export interface PlayerJoints {
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
  /** How far the legs stand apart. */
  legSpread: number;
  /** How far a cape is from hanging straight down. */
  capeTrail: number;
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
    legSpread: 0.055,
    capeTrail: 0.06 + Math.sin(time / 900) * 0.02,
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
    legSpread: 0.015,
    capeTrail: 0.34 + Math.sin(pose.walk * 2) * 0.07,
  };
}

/** Feet apart, ready to work or fight. */
const STANCE = { leftLeg: -0.3, rightLeg: 0.26, leftKnee: 0.2, rightKnee: 0.1, drop: -0.03 };

const BOB_MS = 250;
const SWAY_MS = 610;

/** A fighter between blows: light on bent knees, weight shifting from foot to foot. */
function poised({ time }: Pose) {
  const bob = (1 - Math.cos(time / BOB_MS)) / 2;
  const sway = Math.sin(time / SWAY_MS);
  return {
    bob,
    sway,
    // The knees give way as far as the hips sink, so the feet stay on the ground.
    stance: {
      leftLeg: STANCE.leftLeg - bob * 0.11,
      leftKnee: STANCE.leftKnee + bob * 0.24,
      rightLeg: STANCE.rightLeg - bob * 0.04,
      rightKnee: STANCE.rightKnee + bob * 0.17,
      drop: STANCE.drop - bob * 0.017,
      lean: 0.07 + bob * 0.035,
      twist: sway * 0.09,
      nod: bob * 0.03,
    },
  };
}

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

/** Rod held out in both hands, the tip nodding with the line, now and then a tug. */
const fishing: ActionPose = ({ time }) => {
  const nod = Math.sin(time / 650) * 0.04;
  const tug = Math.max(0, Math.sin(time / 1900) - 0.92) * 4;
  return {
    lean: -0.04,
    nod: 0.12,
    rightArm: -0.85 + nod - tug * 0.5,
    rightElbow: -0.55,
    rightSpread: 0.05,
    leftArm: -0.65 + nod * 0.5 - tug * 0.3,
    leftElbow: -0.85,
    leftSpread: -0.25,
  };
};

const eating: ActionPose = ({ time }) => ({
  rightArm: -1.2,
  rightElbow: -1.7 + Math.sin(time / 90) * 0.12,
  rightSpread: 0.3,
  nod: 0.12,
});

const shooting: ActionPose = pose => {
  const { stance, bob, sway } = poised(pose);
  // Draws the string back again after a shot.
  const drawn = ease(Math.min(1, (1 - pose.hit) * 1.6));
  return {
    ...(pose.moving ? {} : stance),
    twist: 0.55 + sway * 0.04,
    leftArm: -1.5 + bob * 0.05 + sway * 0.03,
    leftElbow: -0.06,
    leftSpread: -0.45,
    rightArm: -1.45 + bob * 0.05,
    rightElbow: mix(-0.7, -1.9 + bob * 0.1, drawn),
    rightSpread: -0.35,
  };
};

const casting: ActionPose = pose => {
  const { stance, bob, sway } = poised(pose);
  const { hit, moving } = pose;
  return {
    ...(moving ? {} : stance),
    rightArm: mix(-1.25 - bob * 0.12, -1.75, hit),
    rightElbow: mix(-0.5 + sway * 0.1, -0.05, hit),
    leftArm: mix(-0.5 - sway * 0.16, -1.6, hit),
    leftElbow: mix(-0.7 - bob * 0.15, -0.15, hit),
    lean: mix(stance.lean, 0.14, hit),
  };
};

/** Weapon up and off hand forward, both circling a little. */
function guarding(pose: Pose) {
  const { stance, bob, sway } = poised(pose);
  return {
    ...stance,
    rightArm: -0.7 - bob * 0.1 + sway * 0.12,
    rightElbow: -0.75 - bob * 0.14,
    leftArm: -0.5 - bob * 0.08 - sway * 0.12,
    leftElbow: -0.9 - bob * 0.12,
  };
}

/** The blow starts and ends wherever the guard is at that moment, so that nothing jumps. */
const slashing: ActionPose = (pose, base) => {
  const rest = guarding(pose);
  const guard = pose.moving
    ? {
        rightArm: rest.rightArm,
        rightElbow: rest.rightElbow,
        leftArm: rest.leftArm,
        leftElbow: rest.leftElbow,
      }
    : rest;
  if (pose.hit <= 0) return guard;
  const through = (joint: keyof typeof rest, raised: number, down: number) =>
    slash(1 - pose.hit, { ...base, ...guard }[joint], raised, down);
  return {
    ...guard,
    rightArm: through('rightArm', -2.5, -0.45),
    rightElbow: through('rightElbow', -0.8, 0),
    twist: through('twist', 0.4, -0.45),
    lean: through('lean', -0.08, 0.26),
    leftArm: through('leftArm', -0.8, 0.2),
    nod: through('nod', 0.05, 0.1),
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
  fish: fishing,
  eat: eating,
  ranged: shooting,
  magic: casting,
  melee: slashing,
};

/** Without a `blend`, the pose is taken on at once. */
export function posePlayer(model: Model, wanted: Pose, blend?: PoseBlend) {
  const pose = blend?.hold(wanted) ?? wanted;
  const base = pose.moving ? walking(pose) : standing(pose);
  const joints = { ...base, ...ACTIONS[pose.action ?? '']?.(pose, base) };
  blend?.apply(joints, pose);
  applyJoints(model.parts, joints);
  hangCape(model.parts, joints);
  holdTool(model.parts, pose);
}

export function applyJoints(parts: Model['parts'], j: PlayerJoints) {
  const hip = HIP + j.drop;
  parts.upper.rotation.set(j.lean, j.twist, 0);
  parts.upper.position.y = parts.hips.position.y = hip;
  parts.hips.rotation.set(j.lean * 0.45, j.twist * 0.3, 0);
  parts.head.rotation.set(j.nod - j.lean * 0.6, -j.twist * 0.7, 0);
  parts.la.rotation.set(j.leftArm, 0, j.leftSpread);
  parts.ra.rotation.set(j.rightArm, 0, j.rightSpread);
  parts.la2.rotation.x = j.leftElbow;
  parts.ra2.rotation.x = j.rightElbow;
  parts.ll.rotation.set(j.leftLeg, 0, j.legSpread);
  parts.rl.rotation.set(j.rightLeg, 0, -j.legSpread);
  parts.ll2.rotation.x = j.leftKnee;
  parts.rl2.rotation.x = j.rightKnee;
  parts.ll.position.y = parts.rl.position.y = hip;
}

/** Hangs straight down whatever the body does, and trails behind while walking. */
export function hangCape({ cape }: Model['parts'], { lean, capeTrail }: PlayerJoints) {
  if (cape) cape.rotation.x = capeTrail - Math.min(0.3, lean);
}

const HAMMER = 'hammer';

function toolFor({ action, tool }: Pose): string | undefined {
  if (action === 'mine' || action === 'chop' || action === 'fish') return tool;
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
  bird(parts, { time, hit, phase, moving }) {
    const peck = Math.sin(hit * Math.PI);
    // Every few seconds it pecks at the ground.
    const grazing = moving ? 0 : Math.max(0, Math.sin(time / 1300 + phase * 3) - 0.6) * 2.5;
    parts.head.rotation.x = peck * 0.9 + grazing * (0.95 + Math.sin(time / 90) * 0.2);
    parts.body.rotation.x = peck * 0.2 + grazing * 0.25;
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
  if (kind === 'crab') return poseCrab(parts, boss, progress);
  let left = 0;
  let right = 0;
  let tilt = Math.sin(performance.now() / 900) * 0.02;
  if (boss.state === 'windup') {
    const [leftLift, rightLift] = BOSS_ARMS[boss.attack!] ?? BOTH_ARMS;
    left = -leftLift * progress * 2.6;
    right = -rightLift * progress * 2.6;
    tilt -= progress * 0.12;
    if (boss.attack === 'vines') left = right = 0.5 * progress; // reaches into the ground
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

/** How far a claw opens, as angles of its finger and of the claw away from it. */
const FINGER_OPEN = 1.25;
const CLAW_TWIST = 0.55;
/** How far a claw turns from straight ahead: to the middle for a snap, and outwards for a double snap. */
const SNAP_AIM = -0.42;
const DOUBLE_SNAP_AIM = 0.65;

/** The sides of the claws that snap in an attack. A single snap takes turns, by the tick at which it lands. */
function snappingSides({ attack, state, start, end }: BossView): number[] {
  if (attack === 'double_snap') return [1, -1];
  if (attack !== 'snap') return [];
  return [(state === 'windup' ? end : start) % 2 ? 1 : -1];
}

/** Claws open in the wind-up, and shut at once when the attack lands. */
function poseCrab(parts: Model['parts'], boss: BossView, progress: number) {
  const sway = Math.sin(performance.now() / 900) * 0.02;
  const snapping = boss.state === 'choose' ? [] : snappingSides(boss);
  const landed = boss.state === 'execute';
  const drawn = Math.min(1, progress * 2); // early, so that the side can be seen
  const shut = landed ? Math.min(1, progress * 8) : 0;
  const recovered = landed ? Math.max(0, progress * 2 - 1) : 0;
  for (const [side, arm, finger] of [
    [1, parts.la, parts.leftFinger],
    [-1, parts.ra, parts.rightFinger],
  ] as const) {
    let open = 0.1 + sway;
    let aim = 0;
    let lift = sway;
    let reach = 0;
    if (snapping.includes(side)) {
      const towards = side * (boss.attack === 'snap' ? SNAP_AIM : DOUBLE_SNAP_AIM);
      aim = towards * (landed ? 1 - recovered : drawn);
      open = landed ? 1 - shut : 0.1 + drawn * 0.9;
      lift = landed ? 0 : -0.25 * drawn;
      reach = landed ? 0.4 * shut * (1 - recovered) - 0.2 * (1 - shut) : -0.2 * drawn;
    } else if (boss.attack === 'jet' && boss.state !== 'choose')
      aim = side * 0.3 * (landed ? 1 - progress : drawn);
    arm.rotation.set(lift, aim + side * CLAW_TWIST * open, 0);
    arm.position.x = side * CLAW_JOINT.x + Math.sin(aim) * reach;
    arm.position.z = CLAW_JOINT.z + Math.cos(aim) * reach;
    finger.rotation.y = -side * FINGER_OPEN * open;
  }
  const spits = boss.attack === 'jet' && boss.state !== 'choose';
  // He leans back before he spits.
  parts.body.rotation.x = sway + (spits ? (landed ? 0.06 * (1 - progress) : -0.1 * drawn) : 0);
}
