// Icons of weapons, tools and ammunition.
import type { Item } from '@driftwake/shared';
import type { Dot, Pixels } from './pixels';
import { GOLD, ICE, LEAF, LEATHER, PAPER, ramp, STONE, WOOD } from './ramp';

export type Draw = (pixels: Pixels, item: Item, color: string[]) => void;

const across = (value: number, ramp: string[]) => ramp[value <= -2 ? 4 : value <= 0 ? 3 : value <= 1 ? 2 : 1];

const handle = (pixels: Pixels, from: number, to: number, ramp: string[]) =>
  pixels.diagonal((a, v) => a >= from && a <= to && v >= -1 && v <= 2 && across(v === -1 ? -2 : v, ramp));

const grip = (pixels: Pixels, from: number, to: number) =>
  pixels.diagonal(
    (a, v) => a >= from && a <= to && Math.abs(v) <= 2 && LEATHER[(a + 60) % 4 < 2 ? 1 : v < 0 ? 4 : 3],
  );

const sword: Draw = (pixels, { tier }, color) => {
  pixels.diagonal((a, v) => {
    if (a < -8 || Math.abs(v) > Math.min(4, 21 - a)) return null;
    return color[v < -2 ? 3 : v < 0 ? 4 : v < 2 ? 2 : 1];
  });
  grip(pixels, -18, -9);
  // Higher tiers get a broader guard, then a jewel.
  const guard = 7 + Math.min(tier, 4);
  const metal = tier ? GOLD : STONE;
  pixels
    .diagonal((a, v) => a >= -10 && a <= -7 && Math.abs(v) <= guard && metal[a > -9 ? 3 : 1])
    .ball(3, 20, 1.9, metal);
  if (tier >= 4) pixels.dotsOf('#e0525f', [7, 15], [8, 15], [7, 16]).dotsOf('#ffc4c0', [7, 15]);
};

const pickaxe: Draw = (pixels, _, color) => {
  handle(pixels, -20, 15, WOOD);
  pixels
    .paint((x, y) => {
      const spread = Math.abs(x + y - 22);
      const away = Math.hypot(x - 5, y - 17) - 14.2;
      if (spread > 17 || x - y < -5 || Math.abs(away) > 2.5 - spread * 0.11) return null;
      return color[away > 0.8 ? 4 : away > -0.2 ? 3 : away > -1.1 ? 2 : 1];
    })
    .diagonal((a, v) => a >= 5 && a <= 9 && Math.abs(v + 0) <= 3 && color[v < 0 ? 2 : 1]);
};

const axe: Draw = (pixels, _, color) => {
  handle(pixels, -20, 19, WOOD);
  pixels.poly(
    [
      [12, 8],
      [10, 6],
      [8, 1],
      [4, 4],
      [2, 8],
      [2, 12],
      [4, 16],
      [8, 13],
      [13, 13],
      [17, 9],
    ],
    (x, y) => {
      const edge = x - Math.abs(y - 9) * 0.28;
      return color[edge < 3.2 ? 4 : edge < 5.4 ? 3 : y < 10 ? 2 : 1];
    },
  );
  pixels.diagonal(
    (a, v) => a >= 1 && a <= 9 && v >= -2 && v <= 2 && color[a === 1 || a === 9 ? 0 : v < 0 ? 2 : 1],
  );
};

const bow: Draw = (pixels, _, color) => {
  pixels.line([4, 3], [20, 19], PAPER[3]);
  pixels.paint((x, y) => {
    const distance = Math.hypot(x - 4, y - 19);
    if (x < 4 || y > 19 || distance < 14.3 || distance > 17) return null;
    return Math.abs(x - y + 0) > 13 ? color[4] : color[distance > 16.2 ? 4 : distance > 15.2 ? 2 : 1];
  });
  pixels.paint((x, y) => {
    const distance = Math.hypot(x - 4, y - 19);
    return (
      distance > 13.8 && distance < 17.4 && Math.abs(x + y - 23) <= 4 && LEATHER[(x - y + 60) % 3 ? 3 : 1]
    );
  });
  pixels.dotsOf(color[4], [3, 2], [4, 2], [21, 19], [21, 20]);
};

/** Wood along the whole length, with prongs holding a stone. */
const staffWith =
  (stone: string[]): Draw =>
  (pixels, _, color) => {
    pixels
      .diagonal((a, v) => a >= -20 && a <= 9 && v >= -1 && v <= 2 && color[v < 0 ? 4 : v < 2 ? 2 : 1])
      .diagonal(
        (a, v) => (a === -6 || a === -5 || a === 5 || a === 6) && v >= -2 && v <= 3 && GOLD[v < 1 ? 3 : 1],
      )
      .paint((x, y) => {
        const away = Math.hypot(x - 17.5, y - 5.5);
        return away > 3.7 && away < 5.6 && x - y < 15 && color[x + y < 20 ? 3 : 1];
      })
      .ball(17.6, 5.4, 3.7, stone)
      .dotsOf('#ffffff', [16, 4]);
  };

const fletching = (pixels: Pixels, dx: number, dy: number) =>
  pixels
    .poly(
      [
        [1 + dx, 17 + dy],
        [5 + dx, 14 + dy],
        [7 + dx, 17 + dy],
        [4 + dx, 20 + dy],
      ],
      PAPER[3],
    )
    .poly(
      [
        [4 + dx, 20 + dy],
        [7 + dx, 17 + dy],
        [10 + dx, 19 + dy],
        [7 + dx, 23 + dy],
      ],
      '#c8584e',
    );

const arrowTip = (pixels: Pixels, color: string[]) =>
  pixels.diagonal((a, v) => {
    if (a < 10 || a > 20 || Math.abs(v) > Math.min((20 - a) * 0.9, 6)) return null;
    if (a < 12 && Math.abs(v) < 3) return null;
    return color[v < -1 ? 4 : v < 1 ? 3 : 1];
  });

const arrow: Draw = (pixels, _, color) => {
  handle(pixels, -16, 14, WOOD);
  fletching(pixels, 0, 0);
  pixels.diagonal((a, v) => a >= -19 && a <= -12 && v >= -1 && v <= 1 && WOOD[v < 0 ? 4 : 2]);
  arrowTip(pixels, color);
};

const arrowhead: Draw = (pixels, _, color) =>
  pixels.poly(
    [
      [12, 1],
      [20, 19],
      [14, 16],
      [14, 22],
      [10, 22],
      [10, 16],
      [4, 19],
    ],
    (x, y) =>
      y > 16 && x > 8 && x < 15 ? color[x < 12 ? 2 : 1] : color[x < 10 ? 4 : x < 12 ? 3 : x < 15 ? 2 : 1],
  );

const shaft: Draw = (pixels, _, color) => {
  for (const offset of [-7, 0, 7])
    pixels.diagonal((a, v) => {
      const beside = v - offset;
      if (Math.abs(a) > 18 - Math.abs(offset) * 0.6 || beside < -1 || beside > 2) return null;
      return a > 15 - Math.abs(offset) * 0.6 ? color[4] : color[beside < 0 ? 4 : beside < 1 ? 3 : 1];
    });
  pixels.diagonal((a, v) => Math.abs(a + 1) <= 2 && Math.abs(v) <= 10 && LEATHER[a < -1 ? 1 : 3]);
};

// --- uniques
const THORN = ramp('#54763a');

/** Vines around a grown, notched blade. */
const rootcleaver: Draw = (pixels, _, color) => {
  pixels.diagonal((a, v) => {
    const wide = a > 12 ? 20 - a : 5 + ((a + 40) % 7 < 3 ? 1 : 0);
    if (a < -8 || Math.abs(v) > wide) return null;
    return Math.abs(v + Math.round(Math.sin(a * 0.5) * 2)) < 1
      ? '#f1ffd0'
      : color[v < -2 ? 4 : v < 1 ? 3 : v < 3 ? 2 : 1];
  });
  handle(pixels, -20, -8, WOOD);
  pixels
    .paint((x, y) => Math.abs(Math.hypot(x - 7, y - 16) - 4) < 1.1 && x + y > 18 && THORN[x < 8 ? 3 : 1])
    .dotsOf(THORN[3], [4, 12], [3, 13], [11, 20], [12, 19], [13, 20])
    .ball(8, 15, 1.6, ramp('#e8b64c'));
};

const briarstring: Draw = (pixels, item, color) => {
  bow(pixels, item, color);
  const thorns: Dot[] = [
    [8, 1],
    [9, 1],
    [15, 4],
    [16, 3],
    [20, 8],
    [21, 8],
    [22, 14],
    [22, 15],
  ];
  pixels
    .dotsOf(THORN[1], ...thorns)
    .dotsOf('#f0708a', [10, 4], [19, 12])
    .dotsOf('#ffb4c0', [11, 4], [19, 13])
    .line([4, 3], [20, 19], '#d8f0a0');
};

const heartwood: Draw = (pixels, item, color) => {
  staffWith(ramp('#e0525f'))(pixels, item, color);
  pixels
    .dotsOf(LEAF[3], [11, 10], [12, 9], [10, 8], [11, 8], [13, 15], [14, 14], [15, 15])
    .dotsOf(LEAF[1], [11, 9], [14, 15]);
};

export const WEAPONS: Record<string, Draw> = {
  sword,
  pickaxe,
  axe,
  bow,
  staff: staffWith(ICE),
  arrow,
  arrowhead,
  shaft,
  rootcleaver,
  briarstring,
  heartwood,
};
