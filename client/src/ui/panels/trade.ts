// What both sides of a trade offer. Clicking items in the inventory offers them.
import { type ClientMsg, ITEMS, type Stack } from '@driftwake/shared';
import { send } from '../../net/connection';
import { state } from '../../net/state';
import { button, h } from '../dom';
import { ALL_ITEMS, coins, isTradable, itemSlot } from '../items';
import type { Panel } from '.';
import { clickQuantity, quantityBar, resetQuantity } from './quantity';

const offer = (item: string, qty: number): ClientMsg => ({ type: 'tradeStep', action: 'offer', item, qty });

const takeBack = (item: string, qty: number) => send({ type: 'tradeStep', action: 'takeBack', item, qty });

const offeredSlot = (stack: Stack) =>
  itemSlot(stack, {
    onClick: () => takeBack(stack.id, clickQuantity()),
    menu: () => [['Take back all', () => takeBack(stack.id, ALL_ITEMS)]],
  });

const worth = (offer: Stack[]) => offer.reduce((total, { id, qty }) => total + ITEMS[id].value * qty, 0);

function side(title: string, offer: Stack[], accepted: boolean, slot: (stack: Stack) => HTMLElement) {
  return [
    h(
      'div',
      { class: 'row offer' },
      h('b', {}, title),
      h(
        'span',
        { class: accepted ? 'k-level' : 'mute' },
        accepted ? 'Accepted' : `Worth ${coins(worth(offer))}`,
      ),
    ),
    offer.length
      ? h('div', { class: 'grid' }, ...offer.map(slot))
      : h('p', { class: 'mute empty-offer' }, 'Nothing yet.'),
  ];
}

const isReady = () => !!state.trade && state.tick >= state.trade.readyAt;

export const tradePanel: Panel = {
  title: 'Trade',
  place: 'anywhere',
  // The accept button becomes usable as ticks pass, without a message about the trade.
  key: () => JSON.stringify([state.trade, isReady(), clickQuantity()]),
  itemUse: {
    click: item => offer(item, clickQuantity()),
    menu: item => (isTradable(item) ? [['Offer all', offer(item, ALL_ITEMS)]] : []),
  },
  onOpen: resetQuantity,
  onClose() {
    if (state.trade) send({ type: 'tradeStep', action: 'decline' });
  },
  render(_self, refresh) {
    const { trade } = state;
    if (!trade) return [];
    const { partner, mine, theirs, iAccepted, theyAccepted } = trade;
    const ready = isReady();
    const accept = button(
      iAccepted ? 'Waiting for the other' : 'Accept',
      () => send({ type: 'tradeStep', action: 'accept' }),
      { disabled: iAccepted || !ready, 'data-focus': 'accept' },
    );
    const decline = button('Decline', () => send({ type: 'tradeStep', action: 'decline' }));
    return [
      quantityBar(refresh),
      ...side('You offer', mine, iAccepted, offeredSlot),
      ...side(`${partner} offers`, theirs, theyAccepted, stack => itemSlot(stack)),
      h('p', { class: 'mute' }, 'Click items in your inventory to offer them.'),
      h('div', { class: 'bar2' }, accept, decline),
    ];
  },
};
