// Death poses. Each runs from 0, the moment of death, to 1, lying still. A pose moves the model's root
// within whatever holds it, so the model must stand at the origin of its own group.
import type * as THREE from 'three';
import { applyJoints, ease, hangCape, mix, type PlayerJoints } from './animation';
import type { Model } from './model';
import { HIP } from './player/plan';

const clamp = (t: number) => Math.min(1, Math.max(0, t));
/** Eases from `from` to `to` of the pose, and holds outside it. */
const during = (t: number, from: number, to: number) => ease(clamp((t - from) / (to - from)));
/** Speeds up like something tipping over, as felled trees do. */
const tipping = (t: number) => t ** 2.4;

type DeathPose = (model: Model, t: number) => void;

/** The size the model was built at, remembered before a pose squashes it. */
function sizeOf(root: THREE.Object3D): number {
  return (root.userData.scale as THREE.Vector3 | undefined)?.x ?? root.scale.x;
}

/** Scales a part by `x`, `y` and `z` from the scale it was built with. */
function rescale(part: THREE.Object3D, x: number, y = x, z = x) {
  part.userData.scale ??= part.scale.clone();
  const built = part.userData.scale as THREE.Vector3;
  part.scale.set(built.x * x, built.y * y, built.z * z);
}

/** Tipped onto one side, raised so that the flank rests on the ground instead of sinking into it. */
function onSide(root: THREE.Object3D, fall: number, lift: number) {
  root.rotation.set(0, 0, fall * (Math.PI / 2));
  root.position.set(0, Math.sin(fall * (Math.PI / 2)) * lift * sizeOf(root), 0);
}

/** How far the flank of each shape is from its middle, before scaling. */
const FLANK = { beast: 0.2, bird: 0.22 };
/** The height of Gnashclaw's shell, which has to clear the ground once he is on his back. */
const SHELL = 1.05;
/** How long the kneeling lasts, as part of the whole fall. */
const KNEEL = 0.45;
/** How high the hips are when kneeling, and when lying face down. */
const KNEELING_HIP = 0.46;
const LYING_HIP = 0.13;

/** Sinks to the knees, then falls forward onto the face. */
function player({ parts, root }: Model, t: number) {
  const kneel = during(t, 0, KNEEL);
  const fall = tipping(clamp((t - KNEEL) / (1 - KNEEL)));
  const lean = mix(0.25 * kneel, 1.5, fall);
  const knee = mix(1.5 * kneel, 0.15, fall);
  const leg = mix(-0.1 * kneel, 1.45, fall);
  const hip = mix(mix(HIP, KNEELING_HIP, kneel), LYING_HIP, fall);
  const arm = mix(0, -0.9, fall);
  const joints: PlayerJoints = {
    lean,
    twist: 0,
    nod: lean * 0.6 + 0.3 * kneel,
    leftArm: arm,
    leftElbow: -0.2,
    leftSpread: mix(0.15, 0.45, fall),
    rightArm: arm,
    rightElbow: -0.2,
    rightSpread: mix(-0.15, -0.45, fall),
    leftLeg: leg,
    leftKnee: knee,
    rightLeg: leg,
    rightKnee: knee,
    drop: hip - HIP,
    legSpread: 0.07,
    capeTrail: lean,
  };
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  applyJoints(parts, joints);
  hangCape(parts, joints);
}

/** Topples onto its side and its legs go stiff. */
function beast({ parts, root }: Model, t: number) {
  const fall = tipping(clamp(t / 0.7));
  const settle = t > 0.7 ? Math.sin(((t - 0.7) / 0.3) * Math.PI) * 0.08 : 0;
  onSide(root, fall - settle, FLANK.beast);
  for (const leg of [parts.ll, parts.rl]) if (leg) leg.rotation.x = -0.35 * fall;
  for (const leg of [parts.lb, parts.rb]) if (leg) leg.rotation.x = 0.35 * fall;
  if (parts.head) parts.head.rotation.x = -0.25 * during(t, 0.4, 1);
}

/** Droops forward and shrinks into itself. */
function plant({ parts, root }: Model, t: number) {
  const wilt = during(t, 0, 1);
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  parts.body.rotation.set(1.1 * wilt, 0, Math.sin(t * 9) * 0.06 * (1 - wilt));
  rescale(parts.body, 1, 1 - 0.4 * wilt, 1);
}

/** Swells and rises while its shards fly apart. */
function wisp({ parts, root }: Model, t: number) {
  const flare = during(t, 0, 0.6);
  const swell = 1 + 0.6 * flare;
  root.rotation.set(0, 0, 0);
  root.position.set(0, 0, 0);
  parts.body.position.y = 1.05 + 0.45 * ease(t);
  rescale(parts.body, swell);
  for (let i = 0; i < 3; i++) {
    const shard = parts[`shard${i}`];
    if (!shard) continue;
    const angle = t * 4 + (i * Math.PI * 2) / 3;
    const reach = 0.45 + 1.3 * ease(t);
    shard.position.set(Math.cos(angle) * reach, 0.1 + t * 0.6, Math.sin(angle) * reach);
  }
}

/** Flaps once and flops over, feet in the air. */
function bird({ parts, root }: Model, t: number) {
  const fall = tipping(clamp((t - 0.2) / 0.6));
  const bounce = t > 0.8 ? Math.sin(((t - 0.8) / 0.2) * Math.PI) * 0.12 : 0;
  onSide(root, fall - bounce, FLANK.bird);
  if (parts.body) parts.body.rotation.x = Math.sin(clamp(t / 0.2) * Math.PI) * -0.3;
  if (parts.head) parts.head.rotation.x = 0.7 * during(t, 0.5, 1);
  for (const leg of [parts.ll, parts.rl]) if (leg) leg.rotation.x = -0.6 * fall;
}

/** Thrown up and over onto its back. */
function crab({ root }: Model, t: number) {
  const flip = during(t, 0, 0.8);
  root.rotation.set(0, 0, flip * Math.PI);
  root.position.set(0, (Math.sin(flip * Math.PI) * 0.8 + flip * SHELL) * sizeOf(root), 0);
}

/** Sinks into the sand, rocking, his claws the last to go. */
function sinking({ parts, root }: Model, t: number) {
  const sink = during(t, 0.1, 1);
  const rock = Math.sin(t * 14) * 0.06 * (1 - sink);
  root.rotation.set(rock, 0, rock * 0.6);
  root.position.set(0, -SHELL * 1.6 * sink * sizeOf(root), 0);
  if (parts.la && parts.ra) {
    parts.la.rotation.x = parts.ra.rotation.x = -0.7 * sink;
  }
}

/** Shakes, then falls apart: the arms drop away and the body slumps into a heap. */
function golem({ parts, root }: Model, t: number) {
  const crumble = tipping(clamp((t - 0.2) / 0.8));
  const shake = Math.sin(t * 70) * 0.04 * (1 - crumble);
  root.rotation.set(0, 0, shake);
  rescale(root, 1 + 0.15 * crumble, 1 - 0.5 * crumble, 1 + 0.15 * crumble);
  root.position.set(0, 0, 0);
  parts.body.rotation.x = 0.45 * crumble;
  for (const [arm, side] of [
    [parts.la, 1],
    [parts.ra, -1],
  ] as const) {
    arm.rotation.set(-0.4 * crumble, 0, side * 1.3 * crumble);
  }
  for (const [leg, side] of [
    [parts.ll, 1],
    [parts.rl, -1],
  ] as const) {
    leg.rotation.set(0, 0, side * 0.5 * crumble);
  }
}

/** Falls backwards like a felled tree, its branches thrown up. */
function treant({ parts, root }: Model, t: number) {
  const fall = tipping(t);
  root.rotation.set(-fall * 1.45, 0, 0);
  root.position.set(0, 0, 0);
  if (parts.la && parts.ra) parts.la.rotation.x = parts.ra.rotation.x = -1.1 * ease(t);
}

const DEATH_POSES: Record<string, DeathPose> = { player, beast, plant, wisp, bird, crab, golem, treant };
/** Bosses that die their own way. */
const BOSS_DEATH_POSES: Record<string, DeathPose> = { crab: sinking };

export const hasDeathPose = (kind: string) => kind in DEATH_POSES;

export function poseDeath(model: Model, progress: number, boss = false) {
  const pose = (boss && BOSS_DEATH_POSES[model.kind]) || DEATH_POSES[model.kind];
  pose?.(model, clamp(progress));
}
