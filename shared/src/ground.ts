// How high the ground is at a point of a map. Browsers draw everything at this height; the server never asks.
import { type GameMap, HEIGHT_UNIT, T } from './map';

/**
 * The height of the ground at a point, in tiles: x and z are world coordinates, where tile (i, j) spans
 * i to i + 1. Heights belong to tile centres and are blended between them, so figures that walk rise and
 * fall smoothly. Water is left out of the blend, so a cliff stays as high as it is up to the water's edge.
 */
export function groundHeight(map: GameMap, x: number, z: number): number {
  const left = Math.floor(x - 0.5);
  const top = Math.floor(z - 0.5);
  const fx = x - 0.5 - left;
  const fz = z - 0.5 - top;
  let sum = 0;
  let weights = 0;
  for (let corner = 0; corner < 4; corner++) {
    const tx = left + (corner & 1);
    const tz = top + (corner >> 1);
    if (tx < 0 || tz < 0 || tx >= map.size || tz >= map.size) continue;
    const weight = (corner & 1 ? fx : 1 - fx) * (corner >> 1 ? fz : 1 - fz);
    const index = tz * map.size + tx;
    if (map.tiles[index] === T.WATER || weight === 0) continue;
    sum += weight * map.heights[index];
    weights += weight;
  }
  return weights ? (sum / weights) * HEIGHT_UNIT : 0;
}
