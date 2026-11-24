// The four haircuts. Each adds locks to a Style; coordinates are in head space (see skull.ts).
import { HAIRCUTS } from '@driftwake/shared';
import { blob, part, shade, type V3 } from '../../geo';
import type { Geometry } from '../model';
import { lock } from './lock';
import { clamp } from './skull';

type Cut = (style: Style) => void;

/** Collects the locks of one head, varying each a little. */
class Style {
  readonly parts: Geometry[] = [];
  /** 1 or -1: mirrors the cut. */
  readonly flip: number;
  private draws = 0;

  constructor(
    readonly color: string,
    private seed: number,
  ) {
    this.flip = (seed >> 3) % 2 ? 1 : -1;
  }

  /** The same sequence every time for the same seed. */
  random(): number {
    const value = Math.sin(++this.draws * 78.233 + this.seed * 0.37) * 43758.5453;
    return value - Math.floor(value);
  }

  jitter(range: number): number {
    return (this.random() - 0.5) * 2 * range;
  }

  add(points: V3[], width: number, thickness: number, tone = 1, blunt = 0) {
    const shape = lock({
      points: points.map(([x, y, z]): V3 => [x * this.flip, y, z]),
      width: width * (1 + this.jitter(0.22)),
      thickness: thickness * (1 + this.jitter(0.2)),
      lean: this.jitter(0.35),
      blunt,
    });
    this.parts.push(part(shape, shade(this.color, tone * (1 + this.jitter(0.1)))));
  }
}

/** Lifted off the forehead, highest off-centre, rolling back over a flatter crown. */
const quiff: Cut = style => {
  for (const [u, lift] of [
    [-0.95, 0.35],
    [-0.55, 0.62],
    [-0.15, 0.85],
    [0.28, 1],
    [0.66, 0.8],
    [1, 0.4],
  ])
    style.add(
      [
        [u * 0.078, 0.282 + style.jitter(0.004), 0.084 - Math.abs(u) * 0.026],
        [u * 0.08 + 0.008, 0.318 + lift * 0.038, 0.112 - Math.abs(u) * 0.026],
        [u * 0.074 + 0.026, 0.342 + lift * 0.074, 0.09 - Math.abs(u) * 0.02],
        [
          u * 0.064 + 0.056 + style.jitter(0.012),
          0.35 + lift * 0.07 + style.jitter(0.008),
          0.026 + style.jitter(0.014),
        ],
      ],
      0.027,
      0.02,
      1.1,
    );
  for (const u of [-0.8, -0.3, 0.2, 0.7])
    style.add(
      [
        [u * 0.075, 0.325, 0.058],
        [u * 0.08 + 0.012, 0.372, 0.034],
        [u * 0.074 + 0.032 + style.jitter(0.012), 0.374 + style.jitter(0.01), -0.018],
        [u * 0.07 + 0.048, 0.35 + style.jitter(0.01), -0.066],
      ],
      0.032,
      0.022,
      1,
    );
  for (const u of [-0.75, -0.2, 0.35, 0.85])
    style.add(
      [
        [u * 0.072, 0.332, -0.01],
        [u * 0.08 + 0.01, 0.356, -0.05],
        [u * 0.074 + 0.012, 0.328 + style.jitter(0.006), -0.1],
        [u * 0.062 + 0.012, 0.272 + style.jitter(0.014), -0.116],
      ],
      0.032,
      0.018,
      0.92,
    );
  for (const s of [-1, 1])
    style.add(
      [
        [s * 0.08, 0.288, 0.058],
        [s * 0.094, 0.306, 0.02],
        [s * 0.096, 0.302, -0.034],
        [s * 0.084, 0.284, -0.078],
      ],
      0.024,
      0.012,
      0.88,
    );
};

/** Everything pushed forward into an uneven, blunt fringe. */
const crop: Cut = style => {
  for (const u of [-0.8, -0.25, 0.3, 0.85])
    style.add(
      [
        [u * 0.06, 0.335, -0.05],
        [u * 0.078, 0.352, -0.07 + style.jitter(0.01)],
        [u * 0.076 + style.jitter(0.008), 0.315, -0.104],
        [u * 0.066 + style.jitter(0.01), 0.266 + style.jitter(0.014), -0.116],
      ],
      0.034,
      0.02,
      0.9,
    );
  for (const u of [-0.9, -0.45, 0, 0.5, 0.95])
    style.add(
      [
        [u * 0.07, 0.335, -0.055],
        [u * 0.08 + style.jitter(0.01), 0.352, -0.02],
        [u * 0.078 + style.jitter(0.016), 0.362 + style.jitter(0.01), 0.028],
        [u * 0.076 + style.jitter(0.02), 0.366 + style.jitter(0.014), 0.07],
      ],
      0.034,
      0.028,
      1.02,
    );
  for (const u of [-0.7, -0.2, 0.3, 0.75])
    style.add(
      [
        [u * 0.07, 0.345, 0.0],
        [u * 0.076 + style.jitter(0.012), 0.36, 0.034],
        [u * 0.078 + style.jitter(0.014), 0.35, 0.078],
        [u * 0.078 + 0.014 + style.jitter(0.014), 0.332 + style.jitter(0.012), 0.114],
      ],
      0.034,
      0.028,
      1.12,
    );
  for (const [u, drop] of [
    [-1, 0.02],
    [-0.66, 0.0],
    [-0.36, 0.024],
    [-0.04, 0.006],
    [0.26, 0.032],
    [0.58, 0.01],
    [0.94, 0.028],
  ])
    style.add(
      [
        [u * 0.07, 0.34, 0.045],
        [u * 0.082, 0.335, 0.09 - Math.abs(u) * 0.016],
        [u * 0.088 + 0.004, 0.302, 0.112 - Math.abs(u) * 0.03],
        [
          u * 0.086 + 0.012 + style.jitter(0.008),
          0.276 - drop * 0.8 + style.jitter(0.003),
          0.11 - Math.abs(u) * 0.034,
        ],
      ],
      0.031,
      0.016,
      1.02,
      0.62,
    );
};

/** Hard part on one side, long top swept across and back, short on the other. */
const sidepart: Cut = style => {
  for (const z of [0.07, 0.034, -0.002, -0.04, -0.076]) {
    const lift = clamp((z + 0.09) / 0.16, 0, 1);
    style.add(
      [
        [0.052, 0.318 - Math.max(0, -z - 0.04) * 0.4, z],
        [0.012, 0.352 + lift * 0.03, z + 0.016 + lift * 0.014],
        [-0.05, 0.352 + lift * 0.026 + style.jitter(0.008), z + lift * 0.02],
        [-0.095 + style.jitter(0.005), 0.292 + lift * 0.012 + style.jitter(0.012), z - 0.026],
      ],
      0.032,
      0.024,
      1.02 + lift * 0.1,
    );
  }
  for (const [z, y] of [
    [0.088, 0.3],
    [0.076, 0.318],
  ])
    style.add(
      [
        [0.05, y - 0.004, z],
        [0.0, y + 0.034, z + 0.03],
        [-0.056, y + 0.028, z + 0.012],
        [-0.094, y - 0.02 + style.jitter(0.01), z - 0.034],
      ],
      0.028,
      0.019,
      1.16,
    );
  for (const z of [0.052, 0.008, -0.04])
    style.add(
      [
        [0.056, 0.318, z],
        [0.08, 0.312, z - 0.006],
        [0.094, 0.286, z - 0.018],
        [0.096, 0.256 + style.jitter(0.008), z - 0.03],
      ],
      0.028,
      0.011,
      0.9,
    );
  for (const u of [-0.8, -0.2, 0.4])
    style.add(
      [
        [u * 0.07, 0.33, -0.05],
        [u * 0.08, 0.338, -0.09],
        [u * 0.074 - 0.006, 0.302, -0.112],
        [u * 0.062 - 0.008, 0.25 + style.jitter(0.012), -0.118],
      ],
      0.034,
      0.016,
      0.9,
    );
};

/** Curls kept to the top, loose and uneven over the forehead. */
const curls: Cut = style => {
  const COUNT = 40;
  for (let i = 0; i < COUNT; i++) {
    const el = Math.acos(1 - (i / COUNT) * 0.62),
      az = i * 2.39996 + style.jitter(0.25),
      s = Math.sin(el),
      over = Math.sin(az) * s > 0.5;
    style.parts.push(
      part(
        blob(0.027 + style.random() * 0.015, 0.16, i),
        shade(style.color, 0.92 + style.random() * 0.28),
        [
          Math.cos(az) * s * 0.103 * style.flip,
          0.262 + Math.cos(el) * 0.104 + style.jitter(0.008) - (over ? style.random() * 0.016 : 0),
          Math.sin(az) * s * 0.114 - 0.01 + (over ? 0.01 : 0),
        ],
        [style.jitter(3), style.jitter(3), style.jitter(3)],
      ),
    );
  }
};

const CUTS: Record<string, Cut> = { quiff, crop, sidepart, curls };

/** The long part of a haircut; `fade` covers the sides. */
export function haircut(cut: number, color: string, seed: number): Geometry[] {
  const style = new Style(color, seed);
  CUTS[HAIRCUTS[cut].id](style);
  return style.parts;
}
