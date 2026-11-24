import { BOAT_PARTS, ITEMS, MAPS, type SelfState } from '@magicka/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { icon } from '../icons';
import { carried } from '../items';
import { closePanel, type Panel } from '.';

function partRow({ id, name, item, qty }: (typeof BOAT_PARTS)[number], self: SelfState) {
  const placed = self.boat[id] ?? 0;
  const done = placed >= qty;
  const progress = `${ITEMS[item].name}: ${placed} of ${qty} placed, ${carried(item)} carried`;
  return h(
    'div',
    { class: 'recipe' },
    h('span', { html: icon(item) }),
    h('div', {}, name, h('small', { class: 'num' }, progress)),
    h('span', { class: done ? 'k-level' : 'mute' }, done && 'Done'),
  );
}

function sail() {
  send({ type: 'boat', op: 'sail' });
  closePanel();
}

export const dockPanel: Panel = {
  title: 'Shipwright',
  render(self) {
    const destination = self.map === 'island' ? MAPS.mainland : MAPS.island;
    const action = self.boatDone
      ? button(`Sail to ${destination.name}`, sail)
      : button('Add what I am carrying', () => send({ type: 'boat', op: 'build' }));
    return [...BOAT_PARTS.map(part => partRow(part, self)), h('div', { class: 'actions' }, action)];
  },
};
