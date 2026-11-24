// A camera that circles and follows a point.
import * as THREE from 'three';

const PITCH_RANGE = [0.45, 1.35] as const;
const DISTANCE_RANGE = [7, 26] as const;
const FOLLOW_SPEED = 10;
/** Beyond this the camera jumps instead of gliding. */
const JUMP_DISTANCE = 12;
const { clamp } = THREE.MathUtils;

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
  readonly focus = new THREE.Vector3(32, 0, 35);
  yaw = 0;
  pitch = 0.95;
  distance = 15;

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

  follow(x: number, z: number, dt: number) {
    const target = new THREE.Vector3(x, 0.6, z);
    const jump = this.focus.distanceTo(target) > JUMP_DISTANCE;
    this.focus.lerp(target, jump ? 1 : 1 - Math.exp(-dt * FOLLOW_SPEED));
  }

  update() {
    const flat = Math.cos(this.pitch) * this.distance;
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * flat,
      this.focus.y + Math.sin(this.pitch) * this.distance,
      this.focus.z + Math.cos(this.yaw) * flat,
    );
    this.camera.lookAt(this.focus);
  }
}
