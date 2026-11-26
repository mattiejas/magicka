// Icons of materials, food and other things carried.
import type { Dot } from './pixels';
import { GOLD, LEAF, LEATHER, PAPER, ramp, STONE, WOOD } from './ramp';
import type { Draw } from './weapons';

const ore: Draw = (pixels, _, color) => {
  pixels
    .lit(
      [
        [7, 5],
        [13, 2],
        [18, 5],
        [22, 12],
        [20, 19],
        [14, 22],
        [5, 21],
        [2, 15],
        [3, 9],
      ],
      STONE,
    )
    .line([7, 5], [10, 11], STONE[4])
    .line([10, 11], [3, 14], STONE[1])
    .line([10, 11], [17, 13], STONE[1])
    .line([17, 13], [14, 21], STONE[0])
    .line([17, 13], [20, 8], STONE[0]);
  for (const [x, y, r] of [
    [8, 8, 2],
    [14, 6, 2.2],
    [6, 16, 2.2],
    [13, 16, 2.6],
    [18, 16, 1.8],
  ])
    pixels.ball(x, y, r, color);
};

const ingot = (x: number, y: number): [Dot[], Dot[], Dot[]] => [
  [
    [x + 3, y],
    [x + 11, y],
    [x + 12, y + 3],
    [x + 2, y + 3],
  ],
  [
    [x + 2, y + 3],
    [x + 12, y + 3],
    [x + 14, y + 9],
    [x, y + 9],
  ],
  [
    [x + 3, y],
    [x + 5, y],
    [x + 3, y + 3],
    [x + 2, y + 3],
  ],
];

const bar: Draw = (pixels, _, color) => {
  for (const [x, y] of [
    [5, 3],
    [0.5, 12],
    [9.5, 12],
  ]) {
    const [top, front, glint] = ingot(x, y);
    pixels
      .poly(front, (_x, py) => color[py < y + 5 ? 2 : 1])
      .poly(top, color[3])
      .poly(glint, color[4]);
    pixels.paint((px, py) => py === Math.floor(y + 8) && px === Math.floor(x) && color[0]);
  }
  pixels
    .line([1, 20], [1, 20], color[0])
    .line([9, 13], [9, 20], color[0])
    .dotsOf('#ffffff', [9, 4], [5, 13], [14, 13]);
};

const log: Draw = (pixels, _, color) => {
  const cut = ramp('#e6cf9c');
  const trunk = (x: number, y: number) => {
    pixels
      .paint(
        (px, py) =>
          px >= x &&
          px <= x + 16 &&
          py >= y &&
          py <= y + 7 &&
          color[py === y ? 4 : py <= y + 2 ? 3 : py <= y + 5 ? 2 : 1],
      )
      .paint(
        (px, py) =>
          px >= x && px < x + 14 && py > y && py < y + 7 && (px * 3 + py * 5) % 11 === 0 && color[0],
      )
      .paint((px, py) => {
        const ring = Math.hypot((px - x - 16) / 0.8, py - y - 3.5);
        return ring < 4.2 && (ring > 3.4 ? color[1] : cut[ring < 1 ? 1 : ring < 2 ? 3 : ring < 2.8 ? 2 : 4]);
      });
  };
  trunk(3, 3);
  trunk(1, 13);
};

/** Seared stripes across a cooked fish, so it is told from a raw one by more than its colour. */
const GRILL = '#4a2e20';

const fish: Draw = (pixels, { id }, color) => {
  const belly = ramp('#efe6d2');
  pixels
    .poly(
      [
        [1, 6],
        [6, 11],
        [6, 14],
        [1, 19],
        [4, 12],
      ],
      (_, y) => color[y < 12 ? 2 : 1],
    )
    .paint((x, y) => {
      const away = Math.hypot((x - 13.5) / 9, (y - 12.5) / 5.2);
      if (away >= 1) return null;
      if (y > 13 && away > 0.35) return belly[y > 15 ? 1 : 2];
      return color[y < 9 ? 4 : y < 11 ? 3 : y < 14 ? 2 : 1];
    })
    .poly(
      [
        [10, 8],
        [13, 4],
        [17, 5],
        [16, 8],
      ],
      color[1],
    )
    .line([9, 10], [9, 15], color[0])
    .dotsOf('#1c1a20', [19, 11])
    .dotsOf('#ffffff', [19, 10]);
  if (id.startsWith('cooked_')) for (const x of [11, 14, 17]) pixels.line([x + 1, 9], [x - 2, 16], GRILL);
};

const hide: Draw = (pixels, _, color) =>
  pixels
    .lit(
      [
        [4, 2],
        [8, 4],
        [10, 1],
        [14, 1],
        [16, 4],
        [20, 2],
        [22, 6],
        [19, 10],
        [20, 15],
        [22, 20],
        [17, 20],
        [13, 18],
        [12, 22],
        [11, 18],
        [7, 20],
        [2, 20],
        [4, 15],
        [5, 10],
        [2, 6],
      ],
      color,
    )
    .paint((x, y) => Math.hypot((x - 11.5) / 4.6, (y - 11) / 5.6) < 1 && color[(x + y) % 5 === 0 ? 4 : 3])
    .line([12, 6], [12, 16], color[1])
    .dotsOf(color[0], [5, 4], [18, 4], [5, 18], [18, 18], [8, 8], [16, 9], [7, 14], [16, 15]);

const fibre: Draw = (pixels, _, color) => {
  const stems: [Dot, Dot][] = [
    [
      [10, 22],
      [3, 4],
    ],
    [
      [11, 22],
      [7, 2],
    ],
    [
      [12, 22],
      [12, 1],
    ],
    [
      [12, 22],
      [16, 2],
    ],
    [
      [13, 22],
      [21, 4],
    ],
  ];
  for (const [i, [from, to]] of stems.entries()) {
    pixels.line(from, to, color[i < 2 ? 3 : i < 4 ? 2 : 1]);
    pixels.line([from[0] + 1, from[1]], [to[0] + 1, to[1] + 1], color[i < 2 ? 2 : 1]);
    pixels.ball(to[0] + 0.5, to[1] + 1, 1.9, color);
  }
  pixels.poly(
    [
      [8, 13],
      [16, 13],
      [16, 17],
      [8, 17],
    ],
    (_x, y) => LEATHER[y === 13 ? 4 : y < 16 ? 3 : 1],
  );
};

/** Shades of the facets above and below a gem's widest part. */
const crown = (x: number, y: number) => {
  if (x + y < 11) return 4;
  if (x < 15) return x >= 9 && y < 5 ? 4 : 3;
  return x - y > 8 ? 1 : 2;
};
const pavilion = (x: number, y: number) => {
  const narrowing = (y - 9) * 0.36;
  if (x < 7 + narrowing) return 3;
  if (x < 12) return 2;
  return x < 17 - narrowing ? 1 : 0;
};

const gem: Draw = (pixels, _, color) =>
  pixels
    .poly(
      [
        [6, 3],
        [18, 3],
        [22, 9],
        [12, 22],
        [2, 9],
      ],
      (x, y) => color[y < 9 ? crown(x, y) : pavilion(x, y)],
    )
    .line([3, 9], [20, 9], color[4])
    .dotsOf('#ffffff', [7, 5], [6, 6], [8, 4]);

const essence: Draw = (pixels, _, color) => {
  const shard = (x: number, y: number, w: number, h: number) =>
    pixels.poly(
      [
        [x, y - h],
        [x + w, y - h * 0.3],
        [x + w * 0.6, y + h],
        [x - w * 0.6, y + h],
        [x - w, y - h * 0.3],
      ],
      (px, py) =>
        px < x - w * 0.3 ? color[py < y ? 4 : 3] : px < x + w * 0.35 ? color[3 - Number(py > y)] : color[1],
    );
  shard(5.5, 16, 3.5, 6);
  shard(18.5, 15, 3.5, 7);
  shard(12, 12, 4.6, 10);
  pixels.dotsOf('#ffffff', [10, 6], [10, 7], [4, 13], [3, 3], [20, 4]);
};

const berries: Draw = (pixels, _, color) => {
  pixels
    .line([12, 2], [8, 12], LEAF[0])
    .line([12, 2], [16, 11], LEAF[0])
    .poly(
      [
        [12, 3],
        [16, 0],
        [22, 3],
        [18, 7],
      ],
      (x, y) => LEAF[x - y > 14 ? 2 : 3],
    )
    .line([13, 4], [19, 4], LEAF[1]);
  for (const [x, y] of [
    [7, 12],
    [16, 12],
    [11.5, 17.5],
  ])
    pixels.ball(x, y, 4.2, color);
  pixels.dotsOf('#ffffff', [5, 10], [14, 10], [10, 15]);
};

const meat: Draw = (pixels, _, color) => {
  const bone = ramp('#eadfc8');
  pixels
    .diagonal((a, v) => a < -6 && a > -18 && Math.abs(v) < 3 && bone[v < 0 ? 4 : 2])
    .ball(3.5, 18, 1.9, bone)
    .ball(5.5, 20.5, 1.9, bone)
    .paint((x, y) => {
      const p = x - y - 4;
      const q = x + y - 23;
      const away = Math.hypot(p / 12, q / 10);
      return away < 1 && (away > 0.84 ? bone[q < 0 ? 3 : 1] : color[q < -4 ? 4 : q < 0 ? 3 : q < 4 ? 2 : 1]);
    })
    .ball(15, 8, 2.2, bone)
    .line([10, 9], [14, 13], color[0])
    .line([9, 13], [12, 16], color[0]);
};

const ration: Draw = (pixels, { id }, color) => {
  if (id === 'feast') {
    const roast = ramp('#b8683a');
    pixels
      .ball(11.5, 11, 7, roast)
      .ball(4.5, 13, 2.6, ramp('#c8484e'))
      .ball(19, 13, 2.6, LEAF)
      .dotsOf(LEAF[4], [9, 6], [13, 8], [10, 10])
      .paint(
        (x, y) =>
          Math.hypot((x - 11.5) / 11, (y - 17) / 3.6) < 1 && y > 14 && color[y < 17 ? 4 : y < 19 ? 3 : 1],
      )
      .line([8, 3], [7, 1], PAPER[2])
      .line([14, 3], [15, 1], PAPER[2]);
    return;
  }
  const bread = ramp('#d09a54');
  pixels
    .ball(8, 8, 5.6, bread)
    .line([5, 6], [8, 4], bread[0])
    .line([7, 8], [10, 6], bread[0])
    .poly(
      [
        [13, 12],
        [14, 4],
        [22, 7],
        [22, 12],
      ],
      (x, y) => ((x * y) % 7 === 0 ? '#d88a2e' : y < 7 ? '#fbe48a' : '#f0c24e'),
    )
    .lit(
      [
        [2, 11],
        [22, 11],
        [20, 20],
        [17, 22],
        [7, 22],
        [4, 20],
      ],
      color,
    )
    .paint(
      (x, y) =>
        y > 11 && y < 21 && x > 3 && x < 20 && (Math.floor(x / 2) + Math.floor(y / 2)) % 2 === 0 && color[1],
    )
    .paint((x, y) => y === 11 && x > 1 && x < 22 && color[4]);
};

const coin: Draw = (pixels, _, color) => {
  const disc = (cx: number, cy: number) =>
    pixels
      .paint((x, y) => {
        const away = Math.hypot(x - cx, (y - cy) / 0.62);
        if (away > 6 && !(Math.abs(x - cx) < 6 && y > cy && y < cy + 3)) return null;
        return away <= 6 ? color[away > 4.8 ? 4 : away > 3.6 ? 2 : 3] : color[1];
      })
      .dotsOf(color[1], [cx, cy - 1], [cx, cy], [cx, cy + 1])
      .paint((x, y) => y === cy + 4 && Math.abs(x - cx) < 4 && color[0]);
  disc(7, 17);
  disc(16, 16);
  disc(11, 11);
  disc(12, 6);
};

const lamp: Draw = (pixels, _, color) => {
  pixels
    .paint((x, y) => Math.abs(Math.hypot(x - 19, y - 12) - 3) < 0.9 && x > 17 && color[2])
    .lit(
      [
        [1, 9],
        [5, 11],
        [8, 10],
        [16, 10],
        [19, 13],
        [16, 18],
        [12, 19],
        [7, 18],
        [4, 14],
        [1, 12],
      ],
      color,
    )
    .poly(
      [
        [8, 10],
        [9, 7],
        [15, 7],
        [16, 10],
      ],
      x => color[x < 11 ? 4 : 2],
    )
    .ball(11.5, 5.5, 1.6, ramp('#e0525f'))
    .poly(
      [
        [7, 22],
        [9, 18],
        [15, 18],
        [17, 22],
      ],
      (_x, y) => color[y < 20 ? 3 : 1],
    )
    .line([7, 13], [14, 13], '#e0525f')
    .dotsOf('#bfe0ff', [2, 7], [1, 6], [2, 5], [3, 4], [3, 3], [2, 2])
    .dotsOf('#ffffff', [7, 11], [8, 11]);
};

const wheel: Draw = (pixels, _, color) =>
  pixels
    .paint((x, y) => {
      const [dx, dy] = [x - 11.5, y - 11.5];
      const away = Math.hypot(dx, dy);
      const spoke = Math.min(Math.abs(dx), Math.abs(dy), Math.abs(dx - dy) * 0.71, Math.abs(dx + dy) * 0.71);
      const knob = away > 8.8 && away < 11.4;
      return (away < 8 || knob) && spoke < (knob ? 1.4 : 0.9) && WOOD[dx + dy < 0 ? 3 : 1];
    })
    .paint((x, y) => {
      const away = Math.hypot(x - 11.5, y - 11.5);
      return away > 6.4 && away < 8.9 && color[x + y < 18 ? 4 : x + y < 24 ? 3 : x + y < 29 ? 2 : 1];
    })
    .ball(11.5, 11.5, 2.4, GOLD);

export const GOODS: Record<string, Draw> = {
  ore,
  bar,
  log,
  fish,
  hide,
  fibre,
  gem,
  essence,
  berries,
  meat,
  ration,
  coin,
  lamp,
  wheel,
};
