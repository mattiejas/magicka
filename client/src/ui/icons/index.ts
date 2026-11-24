// Pixel art of items, drawn once per kind and colour.
import { ITEMS, type Item } from '@driftwake/shared';
import { ARMOUR } from './armour';
import { GOODS } from './goods';
import { Pixels } from './pixels';
import { GOLD, ramp } from './ramp';
import { WEAPONS } from './weapons';

/** By item id for things with art of their own, else by the item's icon. */
const ART = { ...WEAPONS, ...ARMOUR, ...GOODS };
const drawn = new Map<string, string>();

function draw(item: Item): string {
  const pixels = new Pixels();
  (ART[item.id] ?? ART[item.icon])(pixels, item, ramp(item.color));
  pixels.outline();
  if (item.unique) for (let i = 0; i < 4; i++) pixels.line([0, i], [3 - i, i], GOLD[3]);
  return pixels.toDataUrl();
}

/** Markup of an item's icon. */
export function icon(id: string): string {
  let url = drawn.get(id);
  if (!url) {
    url = draw(ITEMS[id]);
    drawn.set(id, url);
  }
  return `<img class="icon" src="${url}" alt="" draggable="false">`;
}
