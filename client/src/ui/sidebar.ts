// Inventory, equipment and skills.
import {
  ITEMS,
  levelForXp,
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
import { collectionLog } from './collection';
import { bar, button, h, renderIfChanged } from './dom';
import { healthBar } from './health';
import { skillIcon } from './icons/skills';
import { clickAction, type ItemAction, menuActions, quickDropAction } from './itemActions';
import { itemSlot, level } from './items';
import { currentPanel, openPanel } from './panels';
import { unlockList } from './unlocks';

const TABS = ['inventory', 'equipment', 'skills', 'quests', 'log'] as const;
type Tab = (typeof TABS)[number];
let currentTab: Tab = 'inventory';

export function sidebar(): HTMLElement {
  const tabs = TABS.map(tab => button(tab, () => selectTab(tab), { 'data-tab': tab }));
  return h(
    'div',
    { id: 'side', class: 'panel' },
    h('div', { class: 'tabs' }, ...tabs),
    h('div', { class: 'body' }),
    healthBar(),
  );
}

function selectTab(tab: Tab) {
  currentTab = tab;
  openSkill = null;
  updateSidebar();
}

interface TabContent {
  render: (self: SelfState) => Node[];
  /** Everything the tab shows that can change. It is only redrawn when this does. */
  shows: (self: SelfState) => unknown;
  /** Redraws parts by itself, after `render`. */
  update?: (self: SelfState, body: HTMLElement) => void;
}
const CONTENT: Record<Tab, TabContent> = {
  inventory: { render: inventory, shows: self => self.inv.length, update: updateInventory },
  equipment: { render: equipment, shows: self => self.equip },
  // A skill's list shows its level only, so that gaining XP leaves it, and where it is scrolled to, alone.
  skills: {
    render: skills,
    shows: self => (openSkill ? [openSkill, levelForXp(self.xp[openSkill])] : self.xp),
  },
  quests: { render: quests, shows: self => [self.quests, self.boatDone] },
  log: { render: collectionLog, shows: self => [self.found, self.kills] },
};

export function updateSidebar() {
  const { self } = state;
  const body = document.querySelector<HTMLElement>('#side .body');
  if (!self || !body) return;
  for (const tab of document.querySelectorAll<HTMLElement>('#side .tabs button'))
    tab.classList.toggle('on', tab.dataset.tab === currentTab);
  body.classList.toggle('log', currentTab === 'log');
  const { render, shows, update } = CONTENT[currentTab];
  renderIfChanged(body, JSON.stringify([currentTab, shows(self)]), () => render(self));
  update?.(self, body);
}

// --- inventory
function inventory({ inv }: SelfState): Node[] {
  return [h('div', { class: 'grid' }, ...inv.map(inventorySlot))];
}

const drawnStacks = new WeakMap<Element, string>();
const stackKey = (stack: Stack | null) => JSON.stringify(stack);

/** Replaces only the slots that changed, so clicking quickly and dragging go on while others change. */
function updateInventory({ inv }: SelfState, body: HTMLElement) {
  const slots = [...body.querySelectorAll<HTMLElement>('.slot')];
  inv.forEach((stack, slot) => {
    const old = slots[slot];
    if (drawnStacks.get(old) === stackKey(stack)) return;
    const focused = document.activeElement === old;
    const drawn = inventorySlot(stack, slot);
    old.replaceWith(drawn);
    if (focused) drawn.focus();
  });
}

function inventorySlot(stack: Stack | null, slot: number): HTMLElement {
  const element = itemSlot(stack, {
    onClick: ({ shiftKey }) => {
      const action = shiftKey ? quickDropAction : clickAction;
      if (stack) perform(action(stack, slot, currentPanel()));
    },
    menu: () =>
      menuActions(stack!, slot, currentPanel()).map(([label, action]) => [label, () => perform(action)]),
  });
  if (!stack) element.removeAttribute('disabled'); // empty slots still accept a dragged item
  makeDraggable(element, !!stack, slot);
  drawnStacks.set(element, stackKey(stack));
  return element;
}

function perform(action: ItemAction | undefined) {
  if (action?.type === 'openPanel') openPanel(action.panel);
  else if (action) send(action);
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
/** The skill whose list of what it opens is showing, instead of all skills. */
let openSkill: Skill | null = null;

function showSkill(skill: Skill | null) {
  openSkill = skill;
  updateSidebar();
  document.querySelector('#side .unlocks .next')?.scrollIntoView({ block: 'nearest' });
}

function skills(self: SelfState): Node[] {
  if (openSkill) return skillUnlocks(openSkill);
  return [h('div', { class: 'skills' }, ...SKILLS.map(skill => skillRow(skill, self.xp[skill])))];
}

function skillUnlocks(skill: Skill): Node[] {
  const current = level(skill);
  return [
    h(
      'div',
      { class: 'skill-head' },
      button('‹ Skills', () => showSkill(null), { class: 'back' }),
      h('span', { class: 'skill-name', html: `${skillIcon(skill, 'skill-icon')}${skill}` }),
      h('b', { class: 'num' }, `Level ${current}`),
    ),
    unlockList(skill, current),
  ];
}

function skillRow(skill: Skill, xp: number): HTMLElement {
  const current = level(skill);
  const isMax = current >= MAX_LEVEL;
  const from = xpForLevel(current);
  const to = xpForLevel(current + 1);
  const progress = isMax ? `${xp} xp` : `${xp} xp, ${to - xp} to level ${current + 1}`;
  return h(
    'button',
    {
      type: 'button',
      class: 'skill',
      title: `${progress}. Click to see what each level opens.`,
      onclick: () => showSkill(skill),
    },
    h('span', { class: 'skill-name', html: `${skillIcon(skill, 'skill-icon')}${skill}` }),
    h('b', { class: 'num' }, String(current)),
    bar(isMax ? 1 : (xp - from) / (to - from)),
  );
}
