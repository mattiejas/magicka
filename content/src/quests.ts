// Authoring source for quests. Run `npm run content` after editing.
import { BOAT_PARTS, METALS, type Skill } from './items';

/** What a step asks for. Everything given has to be true. */
export interface QuestNeed {
  /** Any experience in this skill. */
  xp?: Skill;
  /** One of these, carried, worn or banked. Boat parts that were placed count too. */
  own?: string[];
  /** This part of the boat, complete. */
  boat?: string;
}
/** Where a step is done, marked on the minimap until the player is within `r` tiles of it. */
export interface QuestPlace {
  map: 'island' | 'mainland' | 'mine';
  x: number;
  y: number;
  r: number;
}
export interface Quest {
  id: string;
  name: string;
  /** Said by whoever offers it. */
  offer: string;
  thanks: string;
  steps: { text: string; need: QuestNeed; place: QuestPlace }[];
  reward: [string, number][];
}
const part = (id: string) => BOAT_PARTS.find(p => p.id === id)!;
/** Places on the island, from `content/src/maps.ts`. */
const island = (x: number, y: number, r: number): QuestPlace => ({ map: 'island', x, y, r });
const CRATER = island(45, 20, 5);
const GROVE = island(17, 26, 6);
const FURNACE = island(33, 30, 2);
const MEADOW = island(26, 46, 5);
const ANVIL = island(36, 31, 2);
const FIRE = island(35, 34, 2);
const BEACH = island(51, 40, 5);
const DOCK = island(33, 57, 3);

export const QUESTS: Quest[] = [
  {
    id: 'stranded',
    name: 'Stranded',
    offer: 'My ship broke on these rocks, as yours did. Help me build one boat, and you may have it.',
    thanks: 'She floats! Take this for the crossing.',
    steps: [
      { text: 'Mine copper ore in the crater north-east of camp.', need: { xp: 'mining' }, place: CRATER },
      {
        text: `Chop ${part('hull').qty} ash logs in the grove north-west of camp, and bring them to the shipwright.`,
        need: { boat: 'hull' },
        place: GROVE,
      },
      {
        text: `Smelt ${part('fittings').qty} copper bars at the furnace in camp, from two ore each, and bring them.`,
        need: { boat: 'fittings' },
        place: FURNACE,
      },
      {
        text: `Pick ${part('sail').qty} flax in the meadow south-west of camp, and bring it for the sail.`,
        need: { boat: 'sail' },
        place: MEADOW,
      },
      {
        text: 'Smith a copper sword at the anvil, from three bars and an ash log. You will need it.',
        need: { own: METALS.slice(1).map(metal => `${metal}_sword`) },
        place: ANVIL,
      },
      {
        text: 'Cook a trail ration at the cooking fire in camp, from boar meat and berries.',
        need: { own: ['ration', 'feast', 'ships_wheel'] },
        place: FIRE,
      },
      {
        text: "Defeat Old Gnashclaw on the eastern sand. He swallowed the ship's wheel. When he opens a claw, step off the marked ground.",
        need: { own: ['ships_wheel'] },
        place: BEACH,
      },
      { text: "Bring the ship's wheel to the shipwright.", need: { boat: 'wheel' }, place: DOCK },
    ],
    reward: [
      ['coin', 300],
      ['ration', 5],
    ],
  },
];
