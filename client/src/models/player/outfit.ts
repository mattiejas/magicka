// What a player looks like and wears.
import { HAIR_COLORS, ITEMS, type Item, type Look, nameHash } from '@driftwake/shared';

const SKIN_COLORS = ['#f5cbaa', '#e6b18a', '#b98260', '#865d46'];
const CLOTH_COLORS = ['#c9c6c2', '#8fa3b5', '#b3a486', '#9aa88a', '#a893a5'];

export type BodyWear = 'plate' | 'robe' | 'leather';
export type LegWear = 'greaves' | 'skirt' | 'chaps';
export interface Outfit {
  skin: string;
  hair: string;
  look: Look;
  /** Varies the hair a little from player to player. */
  seed: number;
  /** Colour of the shorts worn without leg armour. */
  cloth: string;
  weapon: Item | null;
  head: Item | null;
  body: Item | null;
  legs: Item | null;
  bodyWear: BodyWear | null;
  legWear: LegWear | null;
}

export function bodyWearOf(item: Item | null): BodyWear | null {
  if (!item) return null;
  if (item.id.endsWith('_plate')) return 'plate';
  return item.id.startsWith('cloth_') ? 'robe' : 'leather';
}

export function legWearOf(item: Item | null): LegWear | null {
  if (!item) return null;
  if (item.id.endsWith('_greaves')) return 'greaves';
  return item.id.startsWith('cloth_') ? 'skirt' : 'chaps';
}

export const isHelm = (item: Item | null) => !!item?.id.endsWith('_helm');

export function outfitOf(name: string, gear: (string | null)[], look: Look): Outfit {
  const seed = nameHash(name);
  const [weapon, head, body, legs] = gear.map(id => (id ? ITEMS[id] : null));
  return {
    skin: SKIN_COLORS[seed % SKIN_COLORS.length],
    hair: HAIR_COLORS[look.color].color,
    look,
    seed,
    cloth: CLOTH_COLORS[(seed >> 4) % CLOTH_COLORS.length],
    weapon,
    head,
    body,
    legs,
    bodyWear: bodyWearOf(body),
    legWear: legWearOf(legs),
  };
}
