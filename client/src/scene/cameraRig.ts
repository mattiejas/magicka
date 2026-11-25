// A camera that circles and follows a point.
import * as THREE from 'three';

const PITCH_RANGE = [0.45, 1.35] as const;
const DISTANCE_RANGE = [7, 26] as const;
const FOLLOW_SPEED = 10;
const FOCUS_HEIGHT = 0.6;
/** Beyond this the camera jumps instead of gliding. */
const JUMP_DISTANCE = 12;
/** How near to the ground the camera may come, and how often that is checked along its way. */
const CLEARANCE = 0.9;
const CLEARANCE_SAMPLES = 10;
const LIFT_SPEED = 8;
const { clamp } = THREE.MathUtils;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
  readonly focus = new THREE.Vector3(32, 0, 35);
  yaw = 0;
  pitch = 0.95;
  distance = 15;
  /** How far the camera is raised to clear the ground. */
  private lift = 0;

  rotate(yaw: number, pitch: number) {
    this.yaw += yaw;
    this.pitch = clamp(this.pitch + pitch, ...PITCH_RANGE);
  }

  zoom(factor: number) {
    this.distance = clamp(this.distance * factor, ...DISTANCE_RANGE);
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** `ground` is the height of the ground under the point to follow. */
  follow(x: number, z: number, ground: number, dt: number) {
    const target = new THREE.Vector3(x, ground + FOCUS_HEIGHT, z);
    const jump = this.focus.distanceTo(target) > JUMP_DISTANCE;
    this.focus.lerp(target, jump ? 1 : 1 - Math.exp(-dt * FOLLOW_SPEED));
  }

  /** `groundAt` keeps the camera out of hills: it is lifted over any ground that lies between it and the focus. */
  update(dt = 0, groundAt: (x: number, z: number) => number = () => 0) {
    const flat = Math.cos(this.pitch) * this.distance;
    const x = this.focus.x + Math.sin(this.yaw) * flat;
    const y = this.focus.y + Math.sin(this.pitch) * this.distance;
    const z = this.focus.z + Math.cos(this.yaw) * flat;
    let lift = 0;
    for (let i = 1; i <= CLEARANCE_SAMPLES; i++) {
      const along = i / CLEARANCE_SAMPLES;
      const x2 = this.focus.x + (x - this.focus.x) * along;
      const z2 = this.focus.z + (z - this.focus.z) * along;
      const line = this.focus.y + (y - this.focus.y) * along;
      lift = Math.max(lift, groundAt(x2, z2) + CLEARANCE - line);
    }
    this.lift += (lift - this.lift) * (1 - Math.exp(-dt * LIFT_SPEED));
    if (!dt) this.lift = lift;
    this.camera.position.set(x, y + this.lift, z);
    this.camera.lookAt(this.focus);
  }
}
