import { ITEMS, RECIPES, type Recipe, type SelfState, TICK_MS } from '@driftwake/shared';
import { send } from '../../net/connection';
import { state } from '../../net/state';
import { button, h } from '../dom';
import { icon } from '../icons';
import { carried, describe, level } from '../items';
import type { Panel } from '.';
import { materials } from './crafting';
import { atStation } from './place';

const ALL = 999;
/** By the level they need, so what opens next is below what is open now. */
const DISHES = RECIPES.filter(r => r.station === 'fire').sort((a, b) => a.level - b.level);

/** What the food on the fire is doing. Only a change of this redraws the panel, so no click is swallowed. */
function phase(fire: SelfState['fire']): 'none' | 'cooking' | 'done' {
  if (!fire) return 'none';
  return state.tick < fire.ready ? 'cooking' : 'done';
}

/** The food on the fire, with a bar that fills until it is done and then runs out until it burns. */
function fireRow(fire: NonNullable<SelfState['fire']>): HTMLElement {
  const done = phase(fire) === 'done';
  const until = done ? fire.burns : fire.ready;
  const bar = h('span', { class: 'fill' });
  bar.style.animationDuration = `${Math.max(0, until - state.tick) * TICK_MS}ms`;
  return h(
    'div',
    { class: `on-fire ${done ? 'done' : ''}` },
    h('span', {}, done ? 'Done! Take it off before it burns.' : 'On the fire…'),
    h('span', { class: 'cook-bar' }, bar),
    button('Take off', () => send({ type: 'takeOff' }), { class: done ? 'on' : '' }),
  );
}

function dishRow(recipe: Recipe): HTMLElement {
  const { id, out, level: needed, safe } = recipe;
  const unlocked = level('cooking') >= needed;
  const canCook = unlocked && recipe.in.every(([item, amount]) => carried(item) >= amount);
  const burns =
    level('cooking') >= safe! ? 'Never burns.' : `Burns less as you level, never from cooking ${safe}.`;
  const details = unlocked
    ? [materials(recipe), h('small', {}, burns)]
    : [h('small', {}, h('span', { class: 'no' }, `Requires cooking ${needed}`))];
  return h(
    'div',
    { class: `recipe ${unlocked ? '' : 'locked'}`, title: describe(out) },
    h('span', { html: icon(out) }),
    h('div', {}, ITEMS[out].name, ...details),
    h(
      'div',
      { class: 'btns' },
      button('Cook all', () => send({ type: 'craft', recipe: id, qty: ALL }), { disabled: !canCook }),
      button('One by one', () => send({ type: 'craft', recipe: id, qty: ALL, intense: true }), {
        disabled: !canCook,
      }),
    ),
  );
}

export const cookingPanel: Panel = {
  title: 'Cooking fire',
  place: atStation('fire'),
  key: ({ inv, xp, fire }) => JSON.stringify([inv, xp.cooking, fire, phase(fire)]),
  render: ({ fire }) => [
    h(
      'p',
      { class: 'mute' },
      'Cook all, and the fire cooks the stack by itself, slowly. Cook one by one, and take each off when it is done, for more experience.',
    ),
    ...(fire ? [fireRow(fire)] : []),
    ...DISHES.map(dishRow),
  ],
};
