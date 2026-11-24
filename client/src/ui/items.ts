// Item slots and descriptions.
import { ITEMS, levelForXp, type Skill, type Stack } from '@driftwake/shared';
import { state } from '../net/state';
import { h } from './dom';
import { icon } from './icons';
import { hideTooltip, type MenuItem, showMenu, showTooltip } from './popups';

/** Asks the server for as many as there are. */
export const ALL_ITEMS = 1_000_000;

export const level = (skill: Skill) => levelForXp(state.self!.xp[skill]);

export const carried = (itemId: string) =>
  state.self!.inv.reduce((total, stack) => total + (stack?.id === itemId ? stack.qty : 0), 0);

const shortQuantity = (qty: number) => (qty >= 10_000 ? `${Math.floor(qty / 1000)}k` : String(qty));

export function describe(itemId: string): string {
  const { name, style, acc, power, armour, heal, req, unique } = ITEMS[itemId];
  const stats = [
    style,
    acc && `accuracy ${acc}`,
    power && `power ${power}`,
    armour && `armour ${armour}`,
    heal && `heals ${heal}`,
  ].filter(Boolean);
  const requirements = Object.entries(req ?? {})
    .filter(([, needed]) => needed > 1)
    .map(([skill, needed]) => `Requires ${skill} ${needed}`);
  return [name, stats.join(', '), ...requirements, unique && 'Unique'].filter(Boolean).join('\n');
}

interface SlotOptions {
  /** Shown while the slot is empty. */
  label?: string;
  onClick?: () => void;
  menu?: () => MenuItem[];
}

export function itemSlot(stack: Stack | null | undefined, { label, onClick, menu }: SlotOptions = {}) {
  return h('button', {
    class: 'slot',
    disabled: !stack,
    'aria-label': stack ? ITEMS[stack.id].name : (label ?? 'Empty'),
    html: stack ? slotContent(stack) : label && `<small>${label}</small>`,
    onclick:
      onClick &&
      (() => {
        hideTooltip();
        onClick();
      }),
    oncontextmenu: (event: MouseEvent) => {
      event.preventDefault();
      if (stack && menu) showMenu(event.clientX, event.clientY, menu());
    },
    onmousemove: (event: MouseEvent) =>
      stack && showTooltip(describe(stack.id), event.clientX, event.clientY),
    onmouseleave: hideTooltip,
  });
}

const slotContent = ({ id, qty }: Stack) => icon(id) + (qty > 1 ? `<span>${shortQuantity(qty)}</span>` : '');
