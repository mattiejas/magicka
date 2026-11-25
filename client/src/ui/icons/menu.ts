// Icons of the buttons under the minimap: hair, settings and log out.
import { Pixels } from './pixels';
import { ramp, WOOD } from './ramp';

export type MenuIcon = 'hair' | 'settings' | 'logout';

const STEEL = ramp('#aab6c4');
const TEAL = ramp('#7cc0b1');
const COMB = ramp('#d9b47a');
const GEAR_TEETH = 8;
const CENTRE = 11.5;

const DRAW: Record<MenuIcon, (pixels: Pixels) => void> = {
  hair: pixels => {
    pixels.lit(
      [
        [3, 6],
        [21, 6],
        [21, 11],
        [3, 11],
      ],
      COMB,
    );
    for (let x = 4; x <= 20; x += 2) pixels.line([x, 11], [x, x < 10 ? 16 : 19], COMB[2]);
  },
  settings: pixels =>
    pixels.paint((x, y) => {
      const distance = Math.hypot(x - CENTRE, y - CENTRE);
      const turn = (Math.atan2(y - CENTRE, x - CENTRE) / (2 * Math.PI)) * GEAR_TEETH;
      const onTooth = Math.abs(turn - Math.round(turn)) < 0.22;
      if (distance < 3.2 || distance > (onTooth ? 10.6 : 7.8)) return null;
      const light = x + y < 2 * CENTRE - 3;
      return STEEL[distance < 5 ? 1 : light ? 4 : 2];
    }),
  logout: pixels => {
    pixels.lit(
      [
        [3, 2],
        [14, 2],
        [14, 22],
        [3, 22],
      ],
      WOOD,
    );
    pixels.dotsOf(WOOD[0], [11, 12], [11, 13]);
    pixels.poly(
      [
        [9, 10],
        [16, 10],
        [16, 7],
        [22, 12],
        [16, 17],
        [16, 14],
        [9, 14],
      ],
      TEAL[3],
    );
  },
};

const drawn = new Map<MenuIcon, string>();

/** The picture of a menu button, as a data URL. */
export function menuIconUrl(name: MenuIcon): string {
  let url = drawn.get(name);
  if (!url) {
    const pixels = new Pixels();
    DRAW[name](pixels);
    pixels.outline();
    url = pixels.toDataUrl();
    drawn.set(name, url);
  }
  return url;
}
