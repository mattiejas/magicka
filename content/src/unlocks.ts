// What each level of each skill opens, built from the content so that it never goes stale. The skills tab lists
// it, and the server names it when a level is reached.
import {
  ITEMS,
  type Item,
  METHODS,
  NODES,
  type NodeDef,
  RECIPES,
  type Recipe,
  SKILLS,
  type Skill,
  type Station,
} from './items';

export interface Unlock {
  level: number;
  kind: 'node' | 'recipe' | 'gear' | 'method';
  /** The node, recipe or item; for a method, the skill. */
  id: string;
  /** What the player can now do, to follow "You can". */
  text: string;
  /** Whose icon to show; a method shows the skill's. */
  item?: string;
}

const GATHER: Record<NodeDef['kind'], string> = {
  rock: 'mine',
  tree: 'chop',
  plant: 'pick',
  spot: 'fish at',
};
const MAKE: Record<Station, string> = { furnace: 'smelt', anvil: 'smith', workbench: 'craft', fire: 'cook' };
/** What glows, for the line about glowing. */
const GLOWING: Record<NodeDef['kind'], string> = {
  rock: 'rocks',
  tree: 'trees',
  plant: 'plants',
  spot: 'fishing spots',
};
const KIND_ORDER: Unlock['kind'][] = ['node', 'recipe', 'gear', 'method'];

/** A unique keeps its name, which is a name of its own. */
const named = (item: Item) => (item.unique ? item.name : item.name.toLowerCase());

const nodeUnlock = (node: NodeDef): Unlock => ({
  level: node.level,
  kind: 'node',
  id: node.id,
  text: `${GATHER[node.kind]} ${node.name.toLowerCase()}`,
  item: node.item,
});

/** Food is named by what goes on the fire, so that "cooked" is not said twice. */
const recipeUnlock = (recipe: Recipe): Unlock => ({
  level: recipe.level,
  kind: 'recipe',
  id: recipe.id,
  text: `${MAKE[recipe.station]} ${named(ITEMS[recipe.station === 'fire' && recipe.in.length === 1 ? recipe.in[0][0] : recipe.out])}`,
  item: recipe.out,
});

const wearVerb = (item: Item) => (item.tool ? 'use' : item.slot === 'weapon' ? 'wield' : 'wear');

const gearUnlocks = (item: Item): [Skill, Unlock][] =>
  Object.entries(item.req ?? {}).map(([skill, level]) => [
    skill as Skill,
    { level, kind: 'gear', id: item.id, text: `${wearVerb(item)} ${named(item)}`, item: item.id },
  ]);

/** Glowing nodes give more XP from the level of methods. */
function methodUnlocks(): [Skill, Unlock][] {
  const glowing = new Map<Skill, NodeDef['kind']>();
  for (const node of Object.values(NODES)) if (node.glows && node.skill) glowing.set(node.skill, node.kind);
  return [...glowing].map(([skill, kind]) => [
    skill,
    { level: METHODS.level, kind: 'method', id: skill, text: `strike glowing ${GLOWING[kind]} for more XP` },
  ]);
}

export function unlocks(): Record<Skill, Unlock[]> {
  const bySkill = Object.fromEntries(SKILLS.map(skill => [skill, [] as Unlock[]])) as Record<Skill, Unlock[]>;
  const found: [Skill, Unlock][] = [
    ...Object.values(NODES).flatMap(node =>
      node.skill ? [[node.skill, nodeUnlock(node)] as [Skill, Unlock]] : [],
    ),
    ...RECIPES.map(recipe => [recipe.skill, recipeUnlock(recipe)] as [Skill, Unlock]),
    ...Object.values(ITEMS).flatMap(gearUnlocks),
    ...methodUnlocks(),
  ];
  for (const [skill, unlock] of found) bySkill[skill].push(unlock);
  // Sorting is stable, so what shares a level and kind keeps the order of the content.
  for (const list of Object.values(bySkill))
    list.sort((a, b) => a.level - b.level || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return bySkill;
}
