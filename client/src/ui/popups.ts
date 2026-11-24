// The tooltip and the right-click menu.
import { button, byId, h, uiRoot } from './dom';

const EDGE_MARGIN = 8;
export type MenuItem = [label: string, action: () => void];

let tooltip: HTMLElement | null = null;

export function showTooltip(text: string, x: number, y: number) {
  if (!text) return hideTooltip();
  if (!tooltip?.isConnected) {
    tooltip = h('div', { id: 'tip', class: 'panel' });
    uiRoot().append(tooltip);
  }
  tooltip.textContent = text;
  placeWithin(tooltip, x + 14, y + 16);
}

export function hideTooltip() {
  tooltip?.remove();
  tooltip = null;
}

export function showMenu(x: number, y: number, items: MenuItem[]) {
  closeMenu();
  hideTooltip();
  if (!items.length) return;
  const entries = items.map(([label, action]) =>
    button(label, () => {
      closeMenu();
      action();
    }),
  );
  const menu = h('div', { id: 'menu', class: 'panel' }, ...entries);
  uiRoot().append(menu);
  placeWithin(menu, x, y);
}

export const closeMenu = () => byId('menu')?.remove();

/** Positions an element, moved inwards if it would leave the window. */
function placeWithin(element: HTMLElement, x: number, y: number) {
  const { width, height } = element.getBoundingClientRect();
  element.style.left = `${Math.min(x, innerWidth - width - EDGE_MARGIN)}px`;
  element.style.top = `${Math.min(y, innerHeight - height - EDGE_MARGIN)}px`;
}
