// Moves a player from one pose to the next over a moment, instead of in one frame.
import { ease, mix, type PlayerJoints, type Pose } from './animation';

export const BLEND_MS = 150;
/** Shorter than a wind-up, so that a blow is never hidden behind the pose before it. */
export const BLOW_BLEND_MS = 80;

const BLOWS = ['melee', 'ranged', 'magic'];
const isBlow = ({ action, hit }: Pose) => hit > 0 && BLOWS.includes(action ?? '');

const MAX_STEP_FLEX = 0.45;
/** How far a leg folds to lift a foot that has to go elsewhere; dragged over the ground it would slide. */
const stepFlex = (travel: number) => Math.min(MAX_STEP_FLEX, Math.abs(travel) * 1.2);

/** The memory of one player. It outlives the model, which is rebuilt when gear changes. */
export class PoseBlend {
  private shown?: PlayerJoints;
  private from?: PlayerJoints;
  private progress = 1;
  private action?: string;
  private moving = false;
  private time = 0;
  private blow?: string;

  /** Keeps a blow that is still running, even when the next step of a walk no longer names it. */
  hold(pose: Pose): Pose {
    if (isBlow(pose)) this.blow = pose.action;
    else if (pose.hit <= 0) this.blow = undefined;
    return this.blow && pose.hit > 0 ? { ...pose, action: this.blow } : pose;
  }

  /** Mixes into `joints`, which must be new every frame, and remembers them. */
  apply(joints: PlayerJoints, pose: Pose) {
    const elapsed = Math.max(0, pose.time - this.time);
    if (this.shown && (pose.action !== this.action || pose.moving !== this.moving)) {
      this.from = this.shown;
      this.progress = 0;
    }
    if (this.from) this.advance(this.from, joints, elapsed / (isBlow(pose) ? BLOW_BLEND_MS : BLEND_MS));
    this.shown = joints;
    this.action = pose.action;
    this.moving = pose.moving;
    this.time = pose.time;
  }

  private advance(from: PlayerJoints, joints: PlayerJoints, step: number) {
    this.progress += step;
    if (this.progress >= 1) {
      this.from = undefined;
      return;
    }
    const leftTravel = joints.leftLeg - from.leftLeg;
    const rightTravel = joints.rightLeg - from.rightLeg;
    const weight = ease(this.progress);
    for (const joint in joints) {
      const name = joint as keyof PlayerJoints;
      joints[name] = mix(from[name], joints[name], weight);
    }
    const lift = Math.sin(Math.PI * this.progress);
    const left = lift * stepFlex(leftTravel);
    const right = lift * stepFlex(rightTravel);
    joints.leftLeg -= left;
    joints.leftKnee += 2 * left;
    joints.rightLeg -= right;
    joints.rightKnee += 2 * right;
  }
}
