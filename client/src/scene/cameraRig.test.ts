import { expect, it } from 'vitest';
import { CameraRig } from './cameraRig';

it('rises over ground that lies between it and the player', () => {
  const rig = new CameraRig();
  rig.follow(10, 10, 0, 1);
  rig.update();
  const flat = rig.camera.position.y;
  const wall = (x: number, z: number) => (Math.hypot(x - 10, z - 10) > 4 ? 12 : 0);
  rig.update(0, wall);
  expect(rig.camera.position.y).toBeGreaterThan(flat + 1);
});

it('follows the ground under the player', () => {
  const rig = new CameraRig();
  rig.follow(10, 10, 3, 1);
  expect(rig.focus.y).toBeGreaterThan(3);
});
