// Icons on ground labels that say who may take an item: a closed eye while only its owner sees it, an open eye
// once it is public, and the reaper's scythe for a unique on its way to the reaper.
import { Pixels } from './pixels';
import { ramp, WOOD } from './ramp';

export type TakeIcon = 'closedEye' | 'openEye' | 'scythe';

const WHITE = ramp('#e8e4da');
const IRIS = ramp('#5f9fd1');
const LID = ramp('#d8c2a8');
const STEEL = ramp('#c3ccd6');
const CENTRE = 11.5;
const EYE_HALF_WIDTH = 10.5;
const EYE_HALF_HEIGHT = 6.5;
const IRIS_RADIUS = 4.6;
const PUPIL_RADIUS = 2;

/** How far above or below the middle the eye reaches at column `x`. */
const eyeReach = (x: number) => EYE_HALF_HEIGHT * (1 - ((x - CENTRE) / EYE_HALF_WIDTH) ** 2);

const DRAW: Record<TakeIcon, (pixels: Pixels) => void> = {
  openEye: pixels =>
    pixels.paint((x, y) => {
      if (Math.abs(y - CENTRE) > eyeReach(x)) return null;
      const distance = Math.hypot(x - CENTRE, y - CENTRE);
      if (distance < PUPIL_RADIUS) return IRIS[0];
      if (distance < IRIS_RADIUS) return IRIS[x + y < 2 * CENTRE ? 3 : 2];
      return WHITE[y < CENTRE ? 3 : 2];
    }),
  closedEye: pixels => {
    // A lid curving down, two pixels thick, with lashes hanging from it.
    pixels.paint((x, y) => {
      if (Math.abs(x - CENTRE) > EYE_HALF_WIDTH) return null;
      const lid = CENTRE - 2 + eyeReach(x) * 0.55;
      return y >= lid - 1 && y <= lid + 1 && LID[3];
    });
    for (const x of [6, 11.5, 17]) {
      const top = Math.round(CENTRE - 1 + eyeReach(x) * 0.55);
      const lean = Math.sign(x - CENTRE) * 2;
      pixels.line([Math.round(x), top], [Math.round(x + lean), top + 4], LID[2]);
    }
  },
  scythe: pixels => {
    pixels.line([7, 22], [16, 3], WOOD[2]);
    pixels.line([8, 22], [17, 3], WOOD[3]);
    pixels.poly(
      [
        [15, 2],
        [18, 4],
        [10, 6],
        [2, 12],
        [5, 6],
        [10, 3],
      ],
      (x, y) => STEEL[x + y < 12 ? 4 : 2],
    );
  },
};

const drawn = new Map<TakeIcon, string>();

/** The picture of a ground label's icon, as a data URL. */
export function takeIconUrl(name: TakeIcon): string {
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
