// How many items one click moves, sells or buys.
import { button, h } from '../dom';
import { ALL_ITEMS } from '../items';

const QUANTITIES: [label: string, qty: number][] = [
  ['1', 1],
  ['5', 5],
  ['All', ALL_ITEMS],
];
let quantity = 1;

export const clickQuantity = () => quantity;

export function resetQuantity() {
  quantity = 1;
}

export function quantityButtons(refresh: () => void): HTMLElement[] {
  const select = (qty: number) => {
    quantity = qty;
    refresh();
  };
  return QUANTITIES.map(([label, qty]) =>
    button(label, () => select(qty), { class: quantity === qty ? 'on' : '' }),
  );
}

/** A row of quantity buttons, with anything else that belongs beside them. */
export const quantityBar = (refresh: () => void, ...beside: HTMLElement[]) =>
  h('div', { class: 'bar2' }, ...quantityButtons(refresh), ...beside);
