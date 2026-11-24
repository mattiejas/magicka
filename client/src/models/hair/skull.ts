// The head's shape, shared by the face and the hair that follows it.
// Head space: chin near y 0.04, crown 0.335, face towards +z.
import type { Ring, V3 } from '../../geo';

/** Corners per ring, so the face is a few broad planes. */
export const HEAD_SIDES = 8;
/** The step between rings 4 and 5 is the brow ledge over the eye sockets. */
export const HEAD: Ring[] = [
  [0.035, 0.044, 0.026, 0.07],
  [0.05, 0.05, 0.042, 0.06],
  [0.105, 0.09, 0.08, 0.024],
  [0.165, 0.102, 0.1, 0.006],
  [0.208, 0.102, 0.095, 0.002],
  [0.226, 0.104, 0.11, 0.0],
  [0.29, 0.098, 0.108, -0.012],
  [0.335, 0.055, 0.07, -0.02],
];

export const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A point on the skull at an angle (PI/2 is the face) and height, pushed outwards. */
export function skullPoint(angle: number, y: number, outwards: number): V3 {
  let i = 0;
  while (i < HEAD.length - 2 && HEAD[i + 1][0] < y) i++;
  const [lowY, lowX, lowZ, lowOffset = 0] = HEAD[i];
  const [highY, highX, highZ, highOffset = 0] = HEAD[i + 1];
  const t = clamp((y - lowY) / (highY - lowY), 0, 1);
  // Follow the flat sides of the head instead of cutting through its corners.
  const step = (Math.PI * 2) / HEAD_SIDES;
  const corner = Math.floor((angle - step / 2) / step) * step + step / 2;
  const along = (angle - corner) / step;
  const x = mix(Math.cos(corner), Math.cos(corner + step), along) * (mix(lowX, highX, t) + outwards);
  const z = mix(Math.sin(corner), Math.sin(corner + step), along) * (mix(lowZ, highZ, t) + outwards);
  return [x, y, z + mix(lowOffset, highOffset, t)];
}
