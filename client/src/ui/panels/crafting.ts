import { ITEMS, RECIPES, type Recipe, SKILLS, type Station } from '@driftwake/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { icon } from '../icons';
import { carried, describe, level } from '../items';
import type { Panel } from '.';
import { atStation } from './place';

const TIERS = [1, 2, 3, 4, 5];
const QUANTITIES: [label: string, qty: number][] = [
  ['1', 1],
  ['5', 5],
  ['All', 999],
];
let selectedTier = 1;

export function materials(recipe: Recipe): HTMLElement {
  const list = h('small');
  for (const [i, [item, qty]] of recipe.in.entries()) {
    if (i) list.append(', ');
    const missing = carried(item) < qty;
    list.append(h('span', { class: missing ? 'no' : '' }, `${qty} ${ITEMS[item].name}`));
  }
  return list;
}

function recipeRow(recipe: Recipe): HTMLElement {
  const { id, out, qty, skill, level: needed } = recipe;
  const unlocked = level(skill) >= needed;
  const canMake = unlocked && recipe.in.every(([item, amount]) => carried(item) >= amount);
  const requirement = h('small', {}, h('span', { class: 'no' }, `Requires ${skill} ${needed}`));
  const buttons = QUANTITIES.map(([label, amount]) =>
    button(label, () => send({ type: 'craft', recipe: id, qty: amount }), { disabled: !canMake }),
  );
  return h(
    'div',
    { class: `recipe ${unlocked ? '' : 'locked'}`, title: describe(out) },
    h('span', { html: icon(out) }),
    h('div', {}, ITEMS[out].name + (qty > 1 ? ` x${qty}` : ''), unlocked ? materials(recipe) : requirement),
    h('div', { class: 'btns' }, ...buttons),
  );
}

export const craftingPanel = (station: Station, title: string): Panel => ({
  title,
  place: atStation(station),
  key: ({ inv }) => JSON.stringify([selectedTier, inv, SKILLS.map(level)]),
  render(_self, refresh) {
    const select = (tier: number) => {
      selectedTier = tier;
      refresh();
    };
    const tabs = TIERS.map(tier =>
      button(`Tier ${tier}`, () => select(tier), { class: selectedTier === tier ? 'on' : '' }),
    );
    const recipes = RECIPES.filter(r => r.station === station && ITEMS[r.out].tier === selectedTier);
    return [h('div', { class: 'bar2' }, ...tabs), ...recipes.map(recipeRow)];
  },
});
