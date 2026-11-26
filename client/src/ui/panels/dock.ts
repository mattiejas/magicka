import { amountOf, BOAT_PARTS, ITEMS, MAPS, QUESTS, type SelfState } from '@driftwake/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { icon } from '../icons';
import { carried } from '../items';
import { closePanel, type Panel } from '.';
import { atStation } from './place';

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

const QUEST = QUESTS.find(quest => quest.id === 'stranded')!;

function questOffer({ quests, boatDone }: SelfState): HTMLElement[] {
  if (boatDone || quests[QUEST.id] !== undefined) return [];
  const reward = QUEST.reward.map(([item, qty]) => amountOf(item, qty)).join(' and ');
  return [
    h('p', {}, QUEST.offer),
    h('p', { class: 'mute' }, `Optional. Reward: ${reward}.`),
    button(`Begin ${QUEST.name}`, () => send({ type: 'startQuest', id: QUEST.id })),
  ];
}

function sail() {
  send({ type: 'boat', op: 'sail' });
  closePanel();
}

export const dockPanel: Panel = {
  title: 'Shipwright',
  place: atStation('dock'),
  key: ({ map, boat, boatDone, quests }) =>
    JSON.stringify([map, boat, boatDone, quests, BOAT_PARTS.map(({ item }) => carried(item))]),
  render(self) {
    const destination = self.map === 'island' ? MAPS.mainland : MAPS.island;
    const action = self.boatDone
      ? button(`Sail to ${destination.name}`, sail)
      : button('Add what I am carrying', () => send({ type: 'boat', op: 'build' }));
    return [
      ...questOffer(self),
      ...BOAT_PARTS.map(part => partRow(part, self)),
      h('div', { class: 'actions' }, action),
    ];
  },
};
