import type { ClientMsg, Stack } from '@driftwake/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { ALL_ITEMS, itemSlot } from '../items';
import type { Panel } from '.';
import { atStation } from './place';
import { clickQuantity, quantityBar, resetQuantity } from './quantity';

const deposit = (item: string, qty: number): ClientMsg => ({ type: 'bank', op: 'deposit', item, qty });

const withdraw = (item: string, qty: number) => send({ type: 'bank', op: 'withdraw', item, qty });

function bankSlot(stack: Stack) {
  return itemSlot(stack, {
    onClick: () => withdraw(stack.id, clickQuantity()),
    menu: () => [['Withdraw all', () => withdraw(stack.id, ALL_ITEMS)]],
  });
}

export const bankPanel: Panel = {
  title: 'Bank',
  place: atStation('bank'),
  key: ({ bank }) => JSON.stringify([bank, clickQuantity()]),
  itemUse: {
    click: item => deposit(item, clickQuantity()),
    menu: item => [['Deposit all', deposit(item, ALL_ITEMS)]],
  },
  onOpen: resetQuantity,
  render({ bank }, refresh) {
    const depositAll = button('Deposit inventory', () => send({ type: 'depositAll' }), {
      class: 'push-right',
    });
    return [
      quantityBar(refresh, depositAll),
      bank.length
        ? h('div', { class: 'grid' }, ...bank.map(bankSlot))
        : h('p', { class: 'mute' }, 'Nothing stored. Click items in your inventory to deposit them.'),
    ];
  },
};
