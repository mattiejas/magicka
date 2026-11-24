// The collection log: what bosses dropped for the player and the capes they earned, and what is missing.
import { ITEMS, MONSTERS, type SelfState, SKILLS } from '@driftwake/shared';
import { h } from './dom';
import { itemSlot } from './items';

interface Source {
  id: string;
  name: string;
  items: string[];
}

/** The same drops as `collectible` in server/internal/game/collection.go. */
const sources = (): Source[] => [
  ...Object.values(MONSTERS)
    .filter(monster => monster.boss)
    .map(({ id, name, loot }) => ({
      id,
      name,
      items: [...(loot.unique ?? []), ...(loot.rare ?? [])].map(([item]) => item),
    })),
  { id: 'skills', name: 'Mastered skills', items: SKILLS.map(skill => `cape_${skill}`) },
];

export function collectionLog({ found }: SelfState): Node[] {
  const all = sources().map(({ id, name, items }) => {
    const counts = items.map(item => found[`${id}/${item}`] ?? 0);
    return { name, items, counts, done: counts.filter(Boolean).length };
  });
  const done = all.reduce((sum, source) => sum + source.done, 0);
  const total = all.reduce((sum, source) => sum + source.items.length, 0);
  const sections = all.flatMap(({ name, items, counts, done }) => [
    h('h2', {}, name, h('span', { class: 'mute num' }, `${done} of ${items.length}`)),
    h('div', { class: 'grid' }, ...items.map((item, i) => logSlot(item, counts[i]))),
  ]);
  return [h('div', { class: 'mute num' }, `${done} of ${total} found`), ...sections];
}

function logSlot(item: string, count: number): HTMLElement {
  const times = ITEMS[item].trophy ? 'Found' : `Found ${count} ${count === 1 ? 'time' : 'times'}`;
  return itemSlot(
    { id: item, qty: Math.max(1, count) },
    { note: count ? times : 'Not found yet', className: count ? undefined : 'missing' },
  );
}
