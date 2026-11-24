// Inventory, equipment and skills.
import {
  ITEMS,
  MAX_LEVEL,
  QUESTS,
  type SelfState,
  SKILLS,
  type Skill,
  SLOTS,
  type Stack,
  xpForLevel,
} from '@driftwake/shared';
import { send } from '../net/connection';
import { state } from '../net/state';
import { bar, button, h } from './dom';
import { ALL_ITEMS, isSellable, isTradable, itemSlot, level } from './items';
import { clickQuantity, isPanelOpen, openPanel } from './panels';
import type { MenuItem } from './popups';

const TABS = ['inventory', 'equipment', 'skills', 'quests'] as const;
const LAMP = 'genie_lamp';
type Tab = (typeof TABS)[number];
let currentTab: Tab = 'inventory';

export function sidebar(): HTMLElement {
  const tabs = TABS.map(tab => button(tab, () => selectTab(tab), { 'data-tab': tab }));
  return h(
    'div',
    { id: 'side', class: 'panel' },
    h('div', { class: 'tabs' }, ...tabs),
    h('div', { class: 'body' }),
  );
}

function selectTab(tab: Tab) {
  currentTab = tab;
  updateSidebar();
}

const RENDER: Record<Tab, (self: SelfState) => Node[]> = { inventory, equipment, skills, quests };

export function updateSidebar() {
  const { self } = state;
  const body = document.querySelector('#side .body');
  if (!self || !body) return;
  for (const tab of document.querySelectorAll<HTMLElement>('#side .tabs button'))
    tab.classList.toggle('on', tab.dataset.tab === currentTab);
  body.replaceChildren(...RENDER[currentTab](self));
}

// --- inventory
function inventory({ inv }: SelfState): Node[] {
  return [h('div', { class: 'grid' }, ...inv.map(inventorySlot))];
}

function inventorySlot(stack: Stack | null, slot: number): HTMLElement {
  const element = itemSlot(stack, {
    onClick: () => stack && useItem(stack, slot),
    menu: () => itemMenu(stack!, slot),
  });
  if (!stack) element.removeAttribute('disabled'); // empty slots still accept a dragged item
  makeDraggable(element, !!stack, slot);
  return element;
}

function useItem({ id }: Stack, slot: number) {
  const item = ITEMS[id];
  if (isPanelOpen('bank')) send({ type: 'bank', op: 'deposit', item: id, qty: clickQuantity() });
  else if (isPanelOpen('shop')) sell(id, clickQuantity());
  else if (isPanelOpen('trade')) offer(id, clickQuantity());
  else if (id === LAMP) openPanel('lamp');
  else if (item.heal) send({ type: 'eat', slot });
  else if (item.slot) send({ type: 'equip', slot });
}

const sell = (item: string, qty: number) => send({ type: 'shop', op: 'sell', item, qty });

const offer = (item: string, qty: number) => send({ type: 'tradeStep', action: 'offer', item, qty });

function itemMenu({ id }: Stack, slot: number): MenuItem[] {
  const item = ITEMS[id];
  const entries: MenuItem[] = [];
  if (item.heal) entries.push([`Eat ${item.name}`, () => send({ type: 'eat', slot })]);
  if (item.slot) entries.push([`Equip ${item.name}`, () => send({ type: 'equip', slot })]);
  if (isPanelOpen('bank'))
    entries.push(['Deposit all', () => send({ type: 'bank', op: 'deposit', item: id, qty: ALL_ITEMS })]);
  if (isPanelOpen('shop') && isSellable(id)) entries.push(['Sell all', () => sell(id, ALL_ITEMS)]);
  if (isPanelOpen('trade') && isTradable(id)) entries.push(['Offer all', () => offer(id, ALL_ITEMS)]);
  if (!item.trophy) entries.push([`Drop ${item.name}`, () => send({ type: 'drop', slot })]);
  return entries;
}

function makeDraggable(element: HTMLElement, hasItem: boolean, slot: number) {
  element.draggable = hasItem;
  element.addEventListener('dragstart', event => event.dataTransfer!.setData('text', String(slot)));
  element.addEventListener('dragover', event => event.preventDefault());
  element.addEventListener('drop', event => {
    event.preventDefault();
    const from = Number(event.dataTransfer!.getData('text'));
    if (from !== slot) send({ type: 'swap', a: from, b: slot });
  });
}

// --- equipment
function equipment({ equip }: SelfState): Node[] {
  const worn = SLOTS.filter(slot => slot !== 'ammo').flatMap(slot =>
    equip[slot] ? [ITEMS[equip[slot].id]] : [],
  );
  const total = (stat: 'acc' | 'power' | 'armour') => worn.reduce((sum, item) => sum + (item[stat] ?? 0), 0);
  const slots = SLOTS.map(slot =>
    itemSlot(equip[slot], { label: slot, onClick: () => send({ type: 'unequip', slot }) }),
  );
  return [
    h('div', { class: 'grid equipment' }, ...slots),
    h(
      'p',
      { class: 'mute num totals' },
      `Accuracy ${total('acc')}   Power ${total('power')}   Armour ${total('armour')}`,
    ),
  ];
}

// --- quests
function quests(self: SelfState): Node[] {
  return QUESTS.flatMap(({ id, name, steps }) => {
    const done = self.quests[id];
    if (done === undefined)
      return [
        h('h2', {}, name),
        h(
          'p',
          { class: 'mute' },
          self.boatDone ? 'You sailed on without it.' : 'Speak to the shipwright at the dock.',
        ),
      ];
    const status = done === steps.length ? 'Completed' : `${done} of ${steps.length}`;
    const seen = steps
      .slice(0, done + 1)
      .map(({ text }, i) => h('li', { class: i < done ? 'mute done' : '' }, text));
    return [h('h2', {}, `${name}: ${status}`), h('ol', { class: 'steps' }, ...seen)];
  });
}

// --- skills
function skills(self: SelfState): Node[] {
  return [h('div', { class: 'skills' }, ...SKILLS.map(skill => skillRow(skill, self.xp[skill])))];
}

function skillRow(skill: Skill, xp: number): HTMLElement {
  const current = level(skill);
  const isMax = current >= MAX_LEVEL;
  const from = xpForLevel(current);
  const to = xpForLevel(current + 1);
  return h(
    'div',
    { class: 'skill', title: isMax ? `${xp} xp` : `${xp} xp, ${to - xp} to level ${current + 1}` },
    h('span', {}, skill),
    h('b', { class: 'num' }, String(current)),
    bar(isMax ? 1 : (xp - from) / (to - from)),
  );
}
