// The collection log: what bosses dropped for the player and the capes they earned, and what is missing.
import { ITEMS, MONSTERS, type SelfState, SKILLS } from '@driftwake/shared';
import { h } from './dom';
import { itemSlot } from './items';

interface Source {
  id: string;
  name: string;
  items: string[];
  /** Chance of each item dropping, same order as items. Capes have none. */
  chances: (number | undefined)[];
}

/** The same drops as `collectible` in server/internal/game/collection.go. */
const sources = (): Source[] => [
  ...Object.values(MONSTERS)
    .filter(monster => monster.boss)
    .map(({ id, name, loot }) => {
      const unique = loot.unique ?? [];
      const rare = loot.rare ?? [];
      return {
        id,
        name,
        items: [...unique, ...rare].map(([item]) => item),
        chances: [...unique.map(([, chance]) => chance), ...rare.map(([, , chance]) => chance)],
      };
    }),
  { id: 'skills', name: 'Mastered skills', items: SKILLS.map(skill => `cape_${skill}`), chances: [] },
];

/** How a drop chance is shown: "1 in 50". */
export function formatChance(chance: number): string {
  return `1 in ${Math.max(1, Math.round(1 / chance))}`;
}

/** Note under a slot: finds so far, or the chance when still missing. */
export function logNote(count: number, chance: number | undefined, trophy: boolean): string {
  if (count) return trophy ? 'Found' : `Found ${count} ${count === 1 ? 'time' : 'times'}`;
  if (chance) return `Not found yet · ${formatChance(chance)}`;
  return 'Not found yet';
}

export function collectionLog({ found, kills }: SelfState): Node[] {
  const all = sources().map(({ id, name, items, chances }) => {
    const counts = items.map(item => found[`${id}/${item}`] ?? 0);
    const killCount = kills[id] ?? 0;
    return { id, name, items, chances, counts, done: counts.filter(Boolean).length, killCount };
  });
  const done = all.reduce((sum, source) => sum + source.done, 0);
  const total = all.reduce((sum, source) => sum + source.items.length, 0);
  const sections = all.flatMap(({ id, name, items, chances, counts, done, killCount }) => {
    const progress = `${done} of ${items.length}`;
    const subtitle =
      id === 'skills' || !killCount
        ? progress
        : `${killCount} ${killCount === 1 ? 'kill' : 'kills'} · ${progress}`;
    return [
      h('h2', {}, name, h('span', { class: 'mute num' }, subtitle)),
      h('div', { class: 'grid' }, ...items.map((item, i) => logSlot(item, counts[i], chances[i]))),
    ];
  });
  return [h('div', { class: 'mute num' }, `${done} of ${total} found`), ...sections];
}

function logSlot(item: string, count: number, chance: number | undefined): HTMLElement {
  return itemSlot(
    { id: item, qty: Math.max(1, count) },
    { note: logNote(count, chance, !!ITEMS[item].trophy), className: count ? undefined : 'missing' },
  );
}
