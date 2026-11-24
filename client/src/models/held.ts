// Tools and weapons. The grip is at the origin, the shaft runs along +y and the working edge faces +z.
import { ball, cone, cyl, gem, merge, part, plate, rbox, shade, taper, type V3 } from '../geo';
import { type Geometry, ring } from './model';

const EDGE_FORWARD: V3 = [0, -Math.PI / 2, 0];
const WOOD = '#7d6144';
const GRIP = '#5a4632';

const haft = (len: number): Geometry[] => [
  part(
    taper(
      [
        [0, -0.16, 0],
        [0, len * 0.4, 0.012],
        [0, len, 0],
      ],
      0.03,
      0.026,
    ),
    WOOD,
  ),
  part(cyl(0.034, 0.034, 0.16), GRIP, [0, 0, 0]),
  part(ball(0.036), shade(WOOD, 0.8), [0, -0.16, 0]),
];

const pickaxe = (color: string) =>
  merge([
    ...haft(0.66),
    part(rbox(0.085, 0.13, 0.11, 0.02), shade(color, 0.8), [0, 0.62, 0]),
    part(
      plate(s => {
        s.moveTo(0, 0.07);
        s.quadraticCurveTo(0.22, 0.06, 0.4, -0.1);
        s.quadraticCurveTo(0.2, 0, 0, -0.03);
        s.quadraticCurveTo(-0.2, 0, -0.34, -0.06);
        s.lineTo(-0.36, -0.02);
        s.quadraticCurveTo(-0.2, 0.07, 0, 0.07);
      }, 0.035),
      color,
      [0, 0.63, 0],
      EDGE_FORWARD,
    ),
  ]);

const axe = (color: string) =>
  merge([
    ...haft(0.68),
    part(rbox(0.08, 0.15, 0.1, 0.02), shade(color, 0.8), [0, 0.6, 0]),
    part(
      plate(s => {
        s.moveTo(-0.07, 0.05);
        s.lineTo(0.06, 0.06);
        s.quadraticCurveTo(0.14, 0.08, 0.2, 0.19);
        s.quadraticCurveTo(0.3, 0, 0.2, -0.2);
        s.quadraticCurveTo(0.14, -0.08, 0.06, -0.06);
        s.lineTo(-0.07, -0.05);
        s.closePath();
      }, 0.03),
      color,
      [0, 0.6, 0.02],
      EDGE_FORWARD,
    ),
  ]);

const hammer = (color: string) =>
  merge([
    ...haft(0.4),
    part(rbox(0.13, 0.14, 0.26, 0.025), color, [0, 0.42, 0]),
    part(rbox(0.145, 0.155, 0.05, 0.015), shade(color, 1.15), [0, 0.42, 0.12]),
  ]);

const sword = (color: string, unique: boolean) =>
  merge([
    part(cyl(0.028, 0.026, 0.2), GRIP, [0, 0, 0]),
    part(ball(0.045), shade(color, 0.8), [0, -0.13, 0]),
    part(
      taper(
        [
          [0, 0.13, -0.17],
          [0, 0.11, 0],
          [0, 0.13, 0.17],
        ],
        0.028,
        0.028,
      ),
      shade(color, 0.75),
    ),
    part(
      plate(
        s => {
          const k = unique ? 0.085 : 0.055,
            h = unique ? 1 : 0.86;
          s.moveTo(-k, 0);
          s.quadraticCurveTo(-k * 0.75, h * 0.5, -k * 0.9, h * 0.82);
          s.lineTo(0, h);
          s.lineTo(k * 0.9, h * 0.82);
          s.quadraticCurveTo(k * 0.75, h * 0.5, k, 0);
          s.closePath();
        },
        0.016,
        0.012,
      ),
      color,
      [0, 0.12, 0],
      EDGE_FORWARD,
    ),
    part(rbox(0.045, 0.6, 0.02, 0.01), shade(color, 0.82), [0, 0.45, 0]),
  ]);

const bow = (color: string, unique: boolean) =>
  merge([
    part(
      taper(
        [
          [0, 0, 0.12],
          [0, 0.22, 0.1],
          [0, 0.44, -0.04],
          [0, 0.56, -0.02],
        ],
        0.034,
        0.014,
      ),
      color,
    ),
    part(
      taper(
        [
          [0, 0, 0.12],
          [0, -0.22, 0.1],
          [0, -0.44, -0.04],
          [0, -0.56, -0.02],
        ],
        0.034,
        0.014,
      ),
      color,
    ),
    part(cyl(0.04, 0.04, 0.2), GRIP, [0, 0, 0.12]),
    part(cyl(0.005, 0.005, 1.1, 6), '#e4dcc8', [0, 0, -0.025]),
    ...(unique
      ? [0.3, -0.3].map(y => part(cone(0.03, 0.12, 6), shade(color, 1.2), [0, y, 0.1], [1.3, 0, 0]))
      : []),
  ]);

const staff = (color: string, unique: boolean) =>
  merge([
    part(
      taper(
        [
          [0.01, -0.62, 0],
          [-0.015, -0.1, 0.01],
          [0.015, 0.4, 0],
          [0, 0.78, 0],
        ],
        0.03,
        0.04,
      ),
      color,
    ),
    part(cyl(0.042, 0.042, 0.16), GRIP),
    ...ring(3).map(a =>
      part(
        taper(
          [
            [0, 0.74, 0],
            [Math.cos(a) * 0.13, 0.86, Math.sin(a) * 0.13],
            [Math.cos(a) * 0.05, 1.06, Math.sin(a) * 0.05],
          ],
          0.03,
          0.01,
        ),
        shade(color, 0.9),
      ),
    ),
    part(gem(0.1), unique ? '#b7e07a' : '#93c4e6', [0, 0.92, 0], [0, 0.3, 0], [1, 1.3, 1]),
  ]);

const SHAPES: Record<string, (color: string, unique: boolean) => Geometry> = {
  pickaxe,
  axe,
  hammer,
  sword,
  bow,
  staff,
};

/** Whether an item icon has a shape that can be held. */
export const isHeld = (icon: string) => icon in SHAPES;

export function heldGeo(icon: string, color: string, unique = false): Geometry {
  return SHAPES[icon]?.(color, unique) ?? part(rbox(0.1, 0.1, 0.1), color);
}
