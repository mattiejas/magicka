// An amount of an item, as text players read: "1 trail ration", "5 trail rations", "300 coins".
import { ITEMS } from './content';

function pluralOf(name: string, plural?: string): string {
  if (plural) return plural;
  return name.endsWith('s') ? name : `${name}s`;
}

/** Lower case inside a sentence, except for the names of uniques. */
const inSentence = (name: string, unique?: boolean) =>
  unique ? name : name[0].toLowerCase() + name.slice(1);

export function amountOf(itemId: string, qty: number): string {
  const { name, one, plural, unique } = ITEMS[itemId];
  const named = qty === 1 ? (one ?? name) : pluralOf(name, plural);
  return `${qty.toLocaleString('en')} ${inSentence(named, unique)}`;
}
