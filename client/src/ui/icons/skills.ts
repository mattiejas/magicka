// Icons of the skills. A skill added to SKILLS needs a drawing here, or the types fail.
import type { Skill } from '@driftwake/shared';
import { Pixels } from './pixels';
import { GOLD, LEATHER, ramp, WOOD } from './ramp';

type DrawSkill = (pixels: Pixels) => void;

const STEEL = ramp('#aab6c4');
const IRON = ramp('#5e6874');
const CRIMSON = ramp('#d6465a');
const VIOLET = ramp('#9a62e0');
const BLUE = ramp('#4c82d6');
const THREAD = ramp('#d9684a');

const across = (value: number, ramp: string[]) => ramp[value <= -2 ? 4 : value <= 0 ? 3 : value <= 1 ? 2 : 1];

/** A handle running up to the right, from `from` to `to` along the diagonal. */
const shaft = (pixels: Pixels, from: number, to: number) =>
  pixels.diagonal((a, v) => a >= from && a <= to && v >= -1 && v <= 2 && across(v === -1 ? -2 : v, WOOD));

const mining: DrawSkill = pixels => {
  shaft(pixels, -20, 14);
  pixels.paint((x, y) => {
    const spread = Math.abs(x + y - 22);
    const away = Math.hypot(x - 5, y - 17) - 14.2;
    if (spread > 17 || x - y < -5 || Math.abs(away) > 2.6 - spread * 0.11) return null;
    return STEEL[away > 0.8 ? 4 : away > -0.2 ? 3 : away > -1.1 ? 2 : 1];
  });
};

const woodcutting: DrawSkill = pixels => {
  shaft(pixels, -20, 17);
  pixels
    .lit(
      [
        [10, 3],
        [19, 2],
        [21, 9],
        [14, 11],
        [11, 8],
      ],
      STEEL,
    )
    .line([19, 2], [21, 9], STEEL[4])
    .line([11, 8], [14, 11], IRON[2]);
};

const smithing: DrawSkill = pixels => {
  pixels
    .lit(
      [
        [2, 8],
        [20, 8],
        [22, 10],
        [16, 13],
        [15, 16],
        [18, 20],
        [6, 20],
        [9, 16],
        [8, 13],
        [3, 12],
      ],
      IRON,
    )
    .line([3, 9], [20, 9], STEEL[3])
    .line([7, 20], [17, 20], IRON[0]);
  pixels
    .dotsOf(GOLD[4], [12, 3], [11, 4], [13, 4], [12, 5], [18, 4], [6, 5])
    .dotsOf(GOLD[3], [12, 2], [12, 6]);
};

const crafting: DrawSkill = pixels => {
  pixels.lit(
    [
      [5, 3],
      [19, 3],
      [19, 6],
      [5, 6],
    ],
    WOOD,
  );
  pixels.lit(
    [
      [5, 18],
      [19, 18],
      [19, 21],
      [5, 21],
    ],
    WOOD,
  );
  pixels.paint(
    (x, y) => y >= 6 && y < 18 && x >= 7 && x <= 17 && THREAD[x < 9 ? 4 : x < 12 ? 3 : x < 15 ? 2 : 1],
  );
  for (let y = 7; y < 18; y += 3) pixels.line([7, y], [17, y + 2], THREAD[0]);
  pixels.line([17, 17], [21, 12], THREAD[3]).dotsOf(STEEL[4], [22, 10], [21, 11]).dotsOf(STEEL[2], [22, 9]);
};

const FIRE = ramp('#f08a3c');

const cooking: DrawSkill = pixels => {
  // A pot over flames, steaming.
  pixels
    .paint((x, y) => {
      const flame = 22 - y - Math.abs(x - 12) * 0.9 - (x % 3 === 0 ? 1.5 : 0);
      return y >= 18 && flame > 0 && FIRE[flame > 2.5 ? 4 : flame > 1.2 ? 3 : 2];
    })
    .paint((x, y) => {
      const away = ((x - 12) / 8.5) ** 2 + ((y - 11) / 7) ** 2;
      return y >= 9 && away <= 1 && IRON[away < 0.25 && x < 12 ? 4 : away < 0.6 ? 3 : 2];
    })
    .line([3, 9], [21, 9], STEEL[3])
    .line([4, 8], [20, 8], STEEL[4])
    .dotsOf(IRON[1], [2, 10], [22, 10], [2, 11], [22, 11])
    .dotsOf('#e8eef2', [9, 5], [10, 4], [9, 3], [14, 6], [15, 5], [14, 4], [15, 3]);
};

const melee: DrawSkill = pixels => {
  pixels.diagonal((a, v) => {
    if (a < -6 || Math.abs(v) > Math.min(3, 21 - a)) return null;
    return STEEL[v < -1 ? 3 : v < 0 ? 4 : v < 2 ? 2 : 1];
  });
  pixels
    .diagonal((a, v) => a >= -8 && a <= -6 && Math.abs(v) <= 7 && GOLD[a > -7 ? 3 : 1])
    .diagonal((a, v) => a >= -17 && a <= -9 && Math.abs(v) <= 1 && LEATHER[(a + 60) % 4 < 2 ? 1 : 3])
    .ball(3, 20, 1.9, GOLD);
};

const ranged: DrawSkill = pixels => {
  pixels.paint((x, y) => {
    const away = Math.hypot(x - 1, y - 12) - 12;
    if (x < 3 || Math.abs(away) > 1.4) return null;
    return WOOD[away < -0.4 ? 4 : away < 0.5 ? 2 : 1];
  });
  pixels.line([3, 3], [3, 21], STEEL[3]).line([3, 12], [20, 12], WOOD[2]);
  pixels
    .poly(
      [
        [19, 9],
        [23, 12],
        [19, 15],
      ],
      STEEL[3],
    )
    .line([3, 12], [6, 10], IRON[2])
    .line([3, 12], [6, 14], IRON[2])
    .dotsOf(CRIMSON[3], [7, 11], [7, 13]);
};

const magic: DrawSkill = pixels => {
  // A wizard's hat: a bent cone on a wide brim, with a gold band and a star.
  pixels
    .lit(
      [
        [10, 16],
        [11, 9],
        [15, 3],
        [19, 2],
        [17, 6],
        [18, 11],
        [20, 16],
      ],
      VIOLET,
    )
    .paint((x, y) => {
      const brim = ((x - 12) / 11) ** 2 + ((y - 18) / 3.2) ** 2;
      return brim <= 1 && VIOLET[brim < 0.35 ? 3 : y < 18 ? 2 : 1];
    })
    .poly(
      [
        [10, 14],
        [20, 14],
        [20, 16],
        [10, 16],
      ],
      GOLD[2],
    )
    .line([10, 14], [20, 14], GOLD[4])
    .dotsOf(GOLD[4], [14, 10], [14, 9], [14, 11], [13, 10], [15, 10])
    .dotsOf(GOLD[4], [3, 5], [3, 4], [3, 6], [2, 5], [4, 5], [21, 8], [21, 7], [21, 9], [20, 8]);
};

const defence: DrawSkill = pixels => {
  pixels.lit(
    [
      [3, 3],
      [12, 1],
      [21, 3],
      [21, 12],
      [17, 18],
      [12, 22],
      [7, 18],
      [3, 12],
    ],
    BLUE,
  );
  pixels
    .line([12, 3], [12, 20], STEEL[3])
    .line([5, 10], [19, 10], STEEL[3])
    .line([13, 3], [13, 20], STEEL[1])
    .line([5, 11], [19, 11], STEEL[1])
    .ball(12, 10, 2.4, GOLD);
};

const vitality: DrawSkill = pixels => {
  pixels.lit(
    [
      [12, 21],
      [3, 12],
      [2, 8],
      [4, 4],
      [8, 3],
      [12, 6],
      [16, 3],
      [20, 4],
      [22, 8],
      [21, 12],
    ],
    CRIMSON,
  );
  pixels.dotsOf('#ffe2dc', [6, 6], [7, 5], [5, 7]);
};

/** By skill, so that a new skill without a drawing is a type error. */
const ART: Record<Skill, DrawSkill> = {
  mining,
  smithing,
  woodcutting,
  crafting,
  cooking,
  melee,
  ranged,
  magic,
  defence,
  vitality,
};

const drawn = new Map<Skill, string>();

/** The icon as an image address, drawn once. */
function skillIconUrl(skill: Skill): string {
  let url = drawn.get(skill);
  if (!url) {
    const pixels = new Pixels();
    ART[skill](pixels);
    pixels.outline();
    url = pixels.toDataUrl();
    drawn.set(skill, url);
  }
  return url;
}

/**
 * Markup of a skill's icon. It has no text alternative: put it next to the skill's name, or give the
 * container a label of its own.
 */
export function skillIcon(skill: Skill, className = 'icon', alt = ''): string {
  return `<img class="${className}" src="${skillIconUrl(skill)}" alt="${alt}" draggable="false">`;
}
