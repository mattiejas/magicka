import type { Stack } from '@driftwake/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { ALL_ITEMS, itemSlot } from '../items';
import type { Panel } from '.';

const QUANTITIES: [label: string, qty: number][] = [
  ['1', 1],
  ['5', 5],
  ['All', ALL_ITEMS],
];
let quantity = 1;

/** How many items one click moves. */
export const bankQuantity = () => quantity;

const withdraw = (item: string, qty: number) => send({ type: 'bank', op: 'withdraw', item, qty });

function bankSlot(stack: Stack) {
  return itemSlot(stack, {
    onClick: () => withdraw(stack.id, quantity),
    menu: () => [['Withdraw all', () => withdraw(stack.id, ALL_ITEMS)]],
  });
}

export const bankPanel: Panel = {
  title: 'Bank',
  onOpen() {
    quantity = 1;
  },
  render({ bank }, refresh) {
    const select = (qty: number) => {
      quantity = qty;
      refresh();
    };
    const choices = QUANTITIES.map(([label, qty]) =>
      button(label, () => select(qty), { class: quantity === qty ? 'on' : '' }),
    );
    const depositAll = button('Deposit inventory', () => send({ type: 'depositAll' }), {
      class: 'push-right',
    });
    return [
      h('div', { class: 'bar2' }, ...choices, depositAll),
      bank.length
        ? h('div', { class: 'grid' }, ...bank.map(bankSlot))
        : h('p', { class: 'mute' }, 'Nothing stored. Click items in your inventory to deposit them.'),
    ];
  },
};
