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
export interface Quest {
  id: string;
  name: string;
  /** Said by whoever offers it. */
  offer: string;
  thanks: string;
  steps: { text: string; need: QuestNeed }[];
  reward: [string, number][];
}
const part = (id: string) => BOAT_PARTS.find(p => p.id === id)!;

export const QUESTS: Quest[] = [
  {
    id: 'stranded',
    name: 'Stranded',
    offer: 'My ship broke on these rocks, as yours did. Help me build one boat, and you may have it.',
    thanks: 'She floats! Take this for the crossing.',
    steps: [
      { text: 'Mine copper ore on the rise north-east of camp.', need: { xp: 'mining' } },
      {
        text: `Chop ${part('hull').qty} ash logs in the grove north-west of camp, and bring them to the shipwright.`,
        need: { boat: 'hull' },
      },
      {
        text: `Smelt ${part('fittings').qty} copper bars at the furnace in camp, from two ore each, and bring them.`,
        need: { boat: 'fittings' },
      },
      {
        text: `Pick ${part('sail').qty} flax in the meadow south-west of camp, and bring it for the sail.`,
        need: { boat: 'sail' },
      },
      {
        text: 'Smith a copper sword at the anvil, from three bars and an ash log. You will need it.',
        need: { own: METALS.slice(1).map(metal => `${metal}_sword`) },
      },
      {
        text: 'Make a trail ration at the workbench, from boar meat and berries.',
        need: { own: ['ration', 'feast', 'ships_wheel'] },
      },
      {
        text: "Defeat Old Gnashclaw on the eastern sand. He swallowed the ship's wheel. Step off marked ground.",
        need: { own: ['ships_wheel'] },
      },
      { text: "Bring the ship's wheel to the shipwright.", need: { boat: 'wheel' } },
    ],
    reward: [
      ['coin', 300],
      ['ration', 5],
    ],
  },
];
