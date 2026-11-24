// The body plan, in metres at rest: hip 0.92, shoulder 1.36, crown about 1.8.
import type { Ring } from '../../geo';

export const LEG_STRETCH = 1.07;
export const HIP = 0.86 * LEG_STRETCH;
export const SHOULDER = 0.47;
/** Thickens rings by `k`, for clothing over a body part. */
export const grow = (r: Ring[], k: number, from = 0, to = r.length): Ring[] =>
  r.slice(from, to).map(([y, x, z, oz, ox]) => [y, x + k, z + k, oz, ox]);
export const TORSO: Ring[] = [
  [-0.05, 0.07, 0.04],
  [0.0, 0.11, 0.075, -0.004],
  [0.08, 0.135, 0.092],
  [0.16, 0.128, 0.086, 0.004],
  [0.24, 0.137, 0.09, 0.005],
  [0.29, 0.149, 0.096, 0.006],
  [0.335, 0.163, 0.108, 0.01],
  [0.4, 0.176, 0.108, 0.004],
  [0.455, 0.168, 0.084, -0.008],
  [0.5, 0.115, 0.07, -0.014],
  [0.54, 0.06, 0.056, -0.012],
];
/** Uneven facets, the same on every model. */
export const chip = (amt: number) => (a: number, i: number) =>
  1 + amt * Math.sin(a * 5.3 + i * 4.1) * Math.sin(a * 2.7 - i * 1.9);
/** Chest shelf, breastbone, ribs, shoulder blades and spine. */
export const torsoShape = (angle: number, ringIndex: number) => {
  const front = Math.sin(angle);
  const side = Math.abs(Math.cos(angle));
  const at = (...rings: number[]) => rings.includes(ringIndex);
  const uneven = chip(0.04)(angle, ringIndex);
  if (front > 0.9) return uneven * (at(6, 7) ? 0.92 : at(5) ? 0.96 : 1);
  if (front > 0.3 && side > 0.3) return uneven * (at(6) ? 1.08 : at(7) ? 1.05 : at(5) ? 0.96 : 1);
  if (front < -0.9) return uneven * (ringIndex >= 3 && ringIndex <= 8 ? 0.84 : 1);
  if (front < -0.3) return uneven * (at(7, 8) ? 1.12 : 1);
  return uneven;
};
export const UPPER_ARM: Ring[] = [
  [0.04, 0.03, 0.04, -0.004, -0.024],
  [0.02, 0.052, 0.056, 0, -0.008],
  [-0.04, 0.06, 0.06],
  [-0.11, 0.048, 0.054, 0.006],
  [-0.2, 0.047, 0.052, 0.006],
  [-0.285, 0.036, 0.04],
];
export const FOREARM: Ring[] = [
  [0.02, 0.036, 0.04],
  [-0.05, 0.05, 0.047, 0.002],
  [-0.11, 0.045, 0.042],
  [-0.22, 0.027, 0.026],
];
export const THIGH: Ring[] = [
  [0.07, 0.02, 0.02],
  [0.045, 0.066, 0.07],
  [-0.02, 0.088, 0.098],
  [-0.14, 0.085, 0.095, 0.006],
  [-0.29, 0.066, 0.074, 0.006],
  [-0.39, 0.054, 0.06, 0.006],
];
export const SHIN: Ring[] = [
  [0.03, 0.053, 0.056, 0.006],
  [-0.03, 0.05, 0.056, 0.004],
  [-0.1, 0.063, 0.068, -0.016],
  [-0.17, 0.06, 0.066, -0.02],
  [-0.28, 0.039, 0.044, -0.008],
  [-0.38, 0.031, 0.036],
  [-0.42, 0.036, 0.044],
];

/** Leather straps, belts and boots. */
export const STRAP = '#6b4a32';
