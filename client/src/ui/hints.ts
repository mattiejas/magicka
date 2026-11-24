// Suggestions for what to do next, shown to newer players.
import { type SelfState, xpForLevel } from '@driftwake/shared';
import { myTrack, state } from '../net/state';
import { byId } from './dom';

interface Hint {
  /** The first hint that applies is shown. */
  applies: (self: SelfState) => boolean;
  text: string;
}

const FIRST_TOOLS = ['copper_pickaxe', 'copper_axe', 'copper_sword'];
/** Players above this level no longer need to be told about marked ground. */
const VETERAN_VITALITY = 12;
const BOSS_RANGE = 12;

function owns({ inv, equip, bank }: SelfState, ...items: string[]): boolean {
  return [...inv, ...Object.values(equip), ...bank].some(stack => stack && items.includes(stack.id));
}

function isNearBoss(): boolean {
  const me = myTrack()?.entity;
  if (!me) return false;
  return [...state.entities.values()].some(
    ({ entity }) => entity.boss && Math.hypot(entity.x - me.x, entity.y - me.y) < BOSS_RANGE,
  );
}

const ANYWHERE: Hint[] = [
  {
    applies: self => self.kept.length > 0,
    text: 'The reaper in town is keeping something you earned.',
  },
  {
    applies: self => self.reaper.length > 0,
    text: 'Your items are safe. Return to your grave, or ask the reaper at camp.',
  },
  {
    applies: self => isNearBoss() && self.xp.vitality < xpForLevel(VETERAN_VITALITY),
    text: 'Marked ground is about to be hit. Step off it before the attack lands.',
  },
];
const ON_THE_ISLAND: Hint[] = [
  {
    applies: self => self.boatDone,
    text: 'Your boat is ready. Speak to the shipwright to sail to the mainland.',
  },
  { applies: self => self.xp.mining === 0, text: 'Mine copper on the rise north-east of camp.' },
  {
    applies: self => self.xp.woodcutting === 0,
    text: 'Chop ash in the grove north-west of camp. You need logs for handles and bows.',
  },
  { applies: self => self.xp.smithing === 0, text: 'Smelt copper ore into bars at the furnace in camp.' },
  {
    applies: self => !owns(self, ...FIRST_TOOLS),
    text: 'Smith a copper tool or sword at the anvil. Better tools gather faster.',
  },
  {
    applies: self => !self.equip.weapon,
    text: 'Click a weapon in your inventory to equip it. Swords, bows and staves each train their own style.',
  },
  {
    applies: self => self.xp.vitality < 60,
    text: 'Fight the boars south-west of camp. Their hides become leather at the workbench.',
  },
  {
    applies: self => (self.boat.hull ?? 0) < 20,
    text: 'Bring 20 ash logs to the shipwright at the south dock to start a boat.',
  },
  {
    applies: self => !self.boat.wheel && !owns(self, 'ships_wheel'),
    text: "Old Gnashclaw, on the eastern sand, swallowed the ship's wheel. Bring food and watch the ground.",
  },
  {
    applies: () => true,
    text: "Finish the boat at the dock: copper bars for fittings, flax for the sail, and the ship's wheel.",
  },
];

export function updateHint() {
  const { self } = state;
  const element = byId('hint');
  if (!self || !element) return;
  const hints = self.map === 'island' ? [...ANYWHERE, ...ON_THE_ISLAND] : ANYWHERE;
  const text = hints.find(hint => hint.applies(self))?.text ?? '';
  element.hidden = !text;
  if (element.textContent !== text) element.textContent = text;
}
