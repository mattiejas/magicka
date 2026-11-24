import { ball, part } from '../../geo';
import { type Geometry, SIDES } from '../model';

/** A pair of eyes with a glint. */
export const eyes = (x: number, y: number, z: number, radius = 0.045, color = '#26231f'): Geometry[] =>
  SIDES.flatMap(side => [
    part(ball(radius), color, [x * side, y, z]),
    part(ball(radius * 0.35), '#f5f0e4', [x * side + radius * 0.3, y + radius * 0.35, z + radius * 0.8]),
  ]);
