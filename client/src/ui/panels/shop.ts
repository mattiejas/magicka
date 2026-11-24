import { type ClientMsg, ECONOMY, ITEMS } from '@driftwake/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { icon } from '../icons';
import { ALL_ITEMS, carried, coins, describe, isSellable } from '../items';
import type { Panel } from '.';
import { atStation } from './place';
import { clickQuantity, quantityBar, resetQuantity } from './quantity';

const sell = (item: string, qty: number): ClientMsg => ({ type: 'shop', op: 'sell', item, qty });

function stockRow(id: string): HTMLElement {
  const { name, value } = ITEMS[id];
  const canAfford = carried('coin') >= value;
  const buy = button('Buy', () => send({ type: 'shop', op: 'buy', item: id, qty: clickQuantity() }), {
    disabled: !canAfford,
    'data-focus': `buy-${id}`,
  });
  return h(
    'div',
    { class: 'recipe', title: describe(id) },
    h('span', { html: icon(id) }),
    h(
      'div',
      {},
      name,
      h('small', { class: 'num' }, h('span', { class: canAfford ? '' : 'no' }, coins(value))),
    ),
    h('div', { class: 'btns' }, buy),
  );
}

export const shopPanel: Panel = {
  title: 'Shop',
  place: atStation('shop'),
  key: () => JSON.stringify([carried('coin'), clickQuantity()]),
  itemUse: {
    click: item => sell(item, clickQuantity()),
    menu: item => (isSellable(item) ? [['Sell all', sell(item, ALL_ITEMS)]] : []),
  },
  onOpen: resetQuantity,
  render(_self, refresh) {
    return [
      quantityBar(refresh, h('span', { class: 'num push-right' }, coins(carried('coin')))),
      ...ECONOMY.shopStock.map(stockRow),
      h(
        'p',
        { class: 'mute' },
        `Click items in your inventory to sell them for ${ECONOMY.sellPercent}% of their value.`,
      ),
    ];
  },
};
