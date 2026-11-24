// Icons of what is worn.
import type { Item } from '@driftwake/shared';
import type { Dot, Pixels } from './pixels';
import { GOLD, LEATHER, ramp } from './ramp';
import type { Draw } from './weapons';

/** Metal, leather and cloth share an icon name but not a shape. */
const byMaterial =
  (metal: Draw, leather: Draw, cloth: Draw): Draw =>
  (pixels, item, color) => {
    const draw = isMade(item, 'leather') ? leather : isMade(item, 'cloth') ? cloth : metal;
    draw(pixels, item, color);
  };
const isMade = (item: Item, material: string) => item.id.startsWith(`${material}_`);

const rivets = (pixels: Pixels, color: string[], ...dots: Dot[]) => pixels.dotsOf(color[4], ...dots);

// --- heads
const helm: Draw = (pixels, { tier }, color) => {
  pixels
    .poly(
      [
        [12, 2],
        [17, 4],
        [20, 9],
        [20, 21],
        [4, 21],
        [4, 9],
        [7, 4],
      ],
      (x, y) => color[x + y * 0.4 < 10 ? 4 : x + y * 0.4 < 14 ? 3 : x < 16 ? 2 : 1],
    )
    .paint((x, y) => y >= 11 && y <= 13 && x >= 6 && x <= 17 && x !== 11 && x !== 12 && '#171427')
    .paint((x, y) => y >= 14 && y <= 20 && x >= 9 && x <= 14 && x % 2 === 1 && '#171427')
    .paint((x, y) => y === 10 && x >= 4 && x <= 19 && color[x < 12 ? 4 : 1])
    .paint((x, y) => (x === 11 || x === 12) && y > 2 && y < 18 && color[x === 11 ? 4 : 2]);
  rivets(pixels, color, [5, 19], [18, 19], [5, 15], [18, 15]);
  if (tier >= 4)
    pixels.poly(
      [
        [11, 0],
        [13, 0],
        [13, 5],
        [11, 5],
      ],
      tier > 4 ? GOLD[3] : '#c8584e',
    );
};

const cowl: Draw = (pixels, _, color) =>
  pixels
    .lit(
      [
        [11, 2],
        [16, 4],
        [20, 10],
        [21, 22],
        [3, 22],
        [4, 10],
        [7, 4],
      ],
      color,
    )
    .paint((x, y) => Math.hypot((x - 11.5) / 5, (y - 14) / 6.2) < 1 && '#1c1626')
    .paint((x, y) => {
      const rim = Math.hypot((x - 11.5) / 5, (y - 14) / 6.2);
      return rim >= 1 && rim < 1.24 && color[x < 11 ? 4 : 1];
    })
    .paint((x, y) => x === 11 && y > 3 && y < 7 && color[y % 2 ? 0 : 4]);

const hood: Draw = (pixels, _, color) =>
  pixels
    .lit(
      [
        [14, 1],
        [17, 5],
        [20, 11],
        [22, 22],
        [2, 22],
        [4, 11],
        [8, 5],
      ],
      color,
    )
    .paint((x, y) => Math.hypot((x - 11.5) / 5.2, (y - 15) / 6.4) < 1 && '#1c1626')
    .paint((x, y) => {
      const rim = Math.hypot((x - 11.5) / 5.2, (y - 15) / 6.4);
      return rim >= 1 && rim < 1.2 && GOLD[x < 11 ? 4 : 2];
    })
    .line([5, 13], [3, 21], color[1])
    .line([18, 13], [20, 21], color[0]);

// --- bodies
const TORSO: Dot[] = [
  [4, 3],
  [9, 2],
  [12, 5],
  [15, 2],
  [20, 3],
  [22, 8],
  [19, 11],
  [18, 22],
  [6, 22],
  [5, 11],
  [2, 8],
];

const plate: Draw = (pixels, { tier }, color) => {
  pixels
    .lit(TORSO, color)
    .paint((x, y) => Math.abs(Math.hypot(x - 8, y - 9) - 4.6) < 0.6 && y > 9 && x > 6 && x < 12 && color[1])
    .paint((x, y) => Math.abs(Math.hypot(x - 15, y - 9) - 4.6) < 0.6 && y > 9 && x < 18 && color[0])
    .paint((x, y) => x === 11 && y > 5 && y < 22 && color[4])
    .paint((x, y) => x === 12 && y > 5 && y < 22 && color[1])
    .paint((x, y) => (y === 16 || y === 19) && x > 5 && x < 18 && color[x < 11 ? 2 : 0])
    .ball(4.5, 6, 3, color)
    .ball(18.5, 6, 3, color);
  rivets(pixels, color, [7, 17], [16, 17], [7, 20], [16, 20]);
  if (tier >= 4)
    pixels.paint((x, y) => y === 5 && x > 8 && x < 15 && GOLD[x < 12 ? 4 : 2]).ball(11.5, 8, 1.6, GOLD);
};

const jerkin: Draw = (pixels, _, color) =>
  pixels
    .lit(TORSO, color)
    .poly(
      [
        [9, 2],
        [12, 8],
        [15, 2],
      ],
      '#1c1626',
    )
    .line([8, 2], [11, 8], color[4])
    .line([15, 2], [12, 8], color[0])
    .paint((x, y) => x >= 10 && x <= 13 && y >= 9 && y <= 15 && (x + y) % 3 === 0 && '#e8d4a8')
    .paint((x, y) => y >= 16 && y <= 17 && x > 5 && x < 18 && LEATHER[y === 16 ? 2 : 0])
    .dotsOf(GOLD[4], [11, 16], [12, 16])
    .dotsOf(GOLD[2], [11, 17], [12, 17])
    .paint((x, y) => y > 17 && y < 22 && (x === 8 || x === 15) && color[0])
    .paint((x, y) => (x === 6 || x === 17) && y > 10 && y % 2 === 0 && color[4]);

const robe: Draw = (pixels, _, color) =>
  pixels
    .lit(
      [
        [8, 2],
        [16, 2],
        [19, 5],
        [23, 14],
        [19, 16],
        [17, 12],
        [19, 22],
        [5, 22],
        [7, 12],
        [5, 16],
        [1, 14],
        [5, 5],
      ],
      color,
    )
    .poly(
      [
        [9, 2],
        [12, 7],
        [15, 2],
      ],
      '#1c1626',
    )
    .paint((x, y) => y > 5 && y < 22 && (x === 11 || x === 12) && GOLD[x === 11 ? 4 : 2])
    .paint((x, y) => (y === 12 || y === 13) && x > 6 && x < 17 && GOLD[y === 12 ? 3 : 1])
    .line([2, 14], [5, 15], GOLD[3])
    .line([19, 15], [22, 13], GOLD[1])
    .paint((x, y) => y > 14 && (x === 8 || x === 15) && y < 21 && color[0])
    .paint((x, y) => y === 21 && x > 4 && x < 19 && GOLD[x < 12 ? 3 : 1]);

// --- legs
const trousers = (pixels: Pixels, color: string[]) =>
  pixels
    .lit(
      [
        [6, 2],
        [18, 2],
        [19, 12],
        [18, 22],
        [13, 22],
        [12, 9],
        [11, 22],
        [6, 22],
        [5, 12],
      ],
      color,
    )
    .paint((x, y) => (y === 2 || y === 3) && x >= 6 && x < 18 && LEATHER[y === 2 ? 3 : 1])
    .dotsOf(GOLD[4], [11, 2], [12, 2], [11, 3], [12, 3]);

const greaves: Draw = (pixels, _, color) => {
  trousers(pixels, color);
  pixels
    .ball(8, 12, 2.4, color)
    .ball(15.5, 12, 2.4, color)
    .paint(
      (x, y) =>
        (y === 8 || y === 16) && x > 5 && x < 18 && x !== 11 && x !== 12 && pixels.at(x, y) && color[0],
    )
    .paint((x, y) => y === 17 && (x === 8 || x === 15) && color[4])
    .paint((x, y) => y >= 20 && pixels.at(x, y) && color[y === 20 ? 4 : 1]);
};

const chaps: Draw = (pixels, _, color) => {
  trousers(pixels, color);
  pixels
    .paint((x, y) => (x === 7 || x === 16) && y > 5 && y < 21 && y % 2 === 0 && pixels.at(x, y) && color[4])
    .paint((x, y) => (y === 13 || y === 14) && x > 6 && x < 10 && color[0])
    .paint((x, y) => (y === 13 || y === 14) && x > 13 && x < 17 && color[0])
    .paint((x, y) => y > 18 && pixels.at(x, y) && LEATHER[y === 19 ? 3 : 1]);
};

const skirt: Draw = (pixels, _, color) =>
  pixels
    .lit(
      [
        [8, 2],
        [16, 2],
        [19, 10],
        [22, 21],
        [2, 21],
        [5, 10],
      ],
      color,
    )
    .line([9, 5], [6, 20], color[1])
    .line([12, 5], [12, 20], color[0])
    .line([15, 5], [18, 20], color[0])
    .line([10, 5], [8, 20], color[4])
    .paint((x, y) => (y === 2 || y === 3) && x >= 8 && x < 16 && GOLD[y === 2 ? 4 : 2])
    .paint((x, y) => y === 19 && pixels.at(x, y) && GOLD[x < 12 ? 3 : 1]);

// --- capes and neck
const cape: Draw = (pixels, _, color) =>
  pixels
    .lit(
      [
        [8, 3],
        [16, 3],
        [19, 10],
        [21, 21],
        [17, 19],
        [15, 22],
        [12, 20],
        [9, 22],
        [7, 19],
        [3, 21],
        [5, 10],
      ],
      color,
    )
    .line([9, 6], [7, 18], color[1])
    .line([10, 6], [9, 20], color[4])
    .line([13, 6], [13, 19], color[1])
    .line([15, 6], [17, 18], color[0])
    .paint((x, y) => y >= 2 && y <= 4 && x >= 7 && x <= 16 && GOLD[y === 2 ? 4 : y === 3 ? 3 : 1])
    .ball(11.5, 4, 1.8, ramp('#e0525f'));

const mantle: Draw = (pixels, item, color) => {
  cape(pixels, item, color);
  const leaf = ramp('#a8cc5c');
  for (const [x, y] of [
    [7, 3],
    [10, 5],
    [14, 5],
    [17, 3],
    [6, 7],
    [17, 8],
    [12, 8],
    [9, 12],
    [15, 13],
  ] as Dot[])
    pixels
      .dotsOf(leaf[3], [x, y], [x + 1, y])
      .dotsOf(leaf[1], [x, y + 1])
      .dotsOf(leaf[4], [x + 1, y - 1]);
};

const chain = (pixels: Pixels, metal: string[]) =>
  pixels.paint((x, y) => {
    const away = Math.hypot((x - 11.5) / 8.6, (y - 4) / 10);
    return y < 14 && away > 0.86 && away < 1.06 && metal[(x + y) % 3 ? 3 : 1];
  });

const amulet: Draw = (pixels, _, color) =>
  chain(pixels, GOLD)
    .ball(11.5, 16, 5.4, GOLD)
    .poly(
      [
        [12, 12],
        [15, 16],
        [12, 20],
        [9, 16],
      ],
      (x, y) => color[x < 11 ? (y < 16 ? 4 : 3) : y < 16 ? 2 : 1],
    )
    .dotsOf('#ffffff', [11, 14]);

const barnacleCharm: Draw = (pixels, _, color) =>
  chain(pixels, LEATHER)
    .poly(
      [
        [12, 11],
        [18, 15],
        [19, 20],
        [15, 22],
        [9, 22],
        [5, 20],
        [6, 15],
      ],
      (x, y) => color[(x * 2 + y) % 5 < 2 ? 1 : x < 10 ? 4 : x < 14 ? 3 : 2],
    )
    .ball(9, 17, 2, ramp('#e8dcc0'))
    .ball(15, 16, 1.6, ramp('#e8dcc0'))
    .ball(13, 20, 1.6, ramp('#e8dcc0'))
    .dotsOf('#1c1626', [9, 17], [15, 16], [13, 20]);

const stoneheart: Draw = (pixels, _, color) =>
  chain(pixels, GOLD)
    .poly(
      [
        [12, 13],
        [15, 11],
        [19, 12],
        [20, 16],
        [12, 23],
        [4, 16],
        [5, 12],
        [9, 11],
      ],
      (x, y) => color[(x - y + 24) % 6 === 0 ? 0 : x < 9 ? 4 : x < 13 ? 3 : x < 16 ? 2 : 1],
    )
    .line([12, 14], [10, 17], '#ffb04a')
    .line([10, 17], [13, 18], '#ff8a3a')
    .line([13, 18], [12, 21], '#ffcf6a');

export const ARMOUR: Record<string, Draw> = {
  helm: byMaterial(helm, cowl, hood),
  body: byMaterial(plate, jerkin, robe),
  legs: byMaterial(greaves, chaps, skirt),
  cape,
  amulet,
  rooted_mantle: mantle,
  barnacle_charm: barnacleCharm,
  stoneheart,
};
