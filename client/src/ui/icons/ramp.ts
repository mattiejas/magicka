// Shades of a colour. Shadows turn towards blue and lights towards yellow, as painters do.
type Rgb = [number, number, number];

const parse = (color: string): Rgb => [1, 3, 5].map(i => Number.parseInt(color.slice(i, i + 2), 16)) as Rgb;
const format = (rgb: number[]) =>
  `#${rgb
    .map(v =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
const blend = (a: Rgb, b: Rgb, t: number) => format(a.map((v, i) => v + (b[i] - v) * t));

const SHADOW: Rgb = [24, 18, 48];
const LIGHT: Rgb = [255, 248, 218];

export const shade = (color: string, brightness: number) => blend(SHADOW, parse(color), brightness);
const tint = (color: string, amount: number) => blend(parse(color), LIGHT, amount);

/** From darkest to lightest; the colour itself is in the middle. */
export const ramp = (color: string): string[] => [
  shade(color, 0.42),
  shade(color, 0.68),
  color,
  tint(color, 0.3),
  tint(color, 0.62),
];

export const WOOD = ramp('#94663a');
export const LEATHER = ramp('#7a4f34');
export const GOLD = ramp('#d9a441');
export const STONE = ramp('#86817c');
export const PAPER = ramp('#d8ccb0');
export const LEAF = ramp('#6f9a48');
export const ICE = ramp('#7fb4e6');
