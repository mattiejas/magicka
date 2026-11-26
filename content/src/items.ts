// Authoring source for items, recipes, nodes, monsters and loot. Run `npm run content` after editing.
import { MAX_LEVEL } from '../../shared/src/formulas';
export const GAME_NAME = 'Driftwake'; // working title; rename here before any public launch
export const SKILLS = [
  'mining',
  'smithing',
  'woodcutting',
  'fishing',
  'crafting',
  'cooking',
  'melee',
  'ranged',
  'magic',
  'defence',
  'vitality',
] as const;
export type Skill = (typeof SKILLS)[number];
export type Style = 'melee' | 'ranged' | 'magic';
export const SLOTS = ['weapon', 'head', 'body', 'legs', 'neck', 'ammo', 'cape'] as const;
export type Slot = (typeof SLOTS)[number];
export const INV_SIZE = 24;
export const TIER_LEVEL = [1, 1, 10, 20, 30, 40];
export const TIER_XP = [0, 25, 45, 75, 120, 180];
export const METALS = ['', 'copper', 'iron', 'mithril', 'cobalt', 'adamantite'];
export const WOODS = ['', 'ash', 'pine', 'oak', 'maple', 'ebony'];
const HIDES = ['', 'Soft', 'Thick', 'Thorned', 'Storm', 'Dread'];
const FIBRES = ['', 'Flax', 'Silkgrass', 'Moonreed', 'Frostvine', 'Nightbloom'];
const GEMS = ['', 'Quartz', 'Topaz', 'Garnet', 'Opal', 'Beryl'];
export const METAL_COLORS = ['#94887c', '#e07f3c', '#b4bcc8', '#7fb0f0', '#2f62c8', '#2fb58a'];
export const WOOD_COLORS = ['#8a7a60', '#d8b47c', '#b87a48', '#8f5c38', '#b04a38', '#4a3454'];
const HIDE_COLORS = ['', '#b98f66', '#8d6a4c', '#6e7b4a', '#5c6f8c', '#6b4456'];
const FIBRE_COLORS = ['', '#d7c98f', '#a8c27a', '#a9b6d6', '#8fc7cf', '#8a6cae'];
const GEM_COLORS = ['', '#dfe3e6', '#e0a640', '#a83b4b', '#b9d6d0', '#4fb38a'];
/** One fish for each tier. Raw fish heals nothing until it is cooked. */
export const FISH = ['', 'perch', 'trout', 'pike', 'salmon', 'sturgeon'];
const FISH_COLORS = ['', '#8f9a6a', '#a07a6a', '#6f8a6a', '#d08068', '#6a6f80'];

export interface Item {
  id: string;
  name: string;
  icon: string;
  color: string;
  tier: number;
  stack?: boolean;
  slot?: Slot;
  style?: Style;
  acc?: number;
  power?: number;
  armour?: number;
  speed?: number;
  range?: number;
  req?: Partial<Record<Skill, number>>;
  tool?: Tool;
  ammo?: 'arrow' | 'essence';
  heal?: number;
  unique?: boolean;
  /** What it is worth, in coins. */
  value: number;
  /** Sold in every shop, and never bought back. */
  basic?: boolean;
  /** Can never be traded, sold or dropped. */
  trophy?: boolean;
  /** Can never be traded or sold. */
  bound?: boolean;
}
export type Tool = 'pickaxe' | 'axe' | 'rod';
export const ITEMS: Record<string, Item> = {};
/** Items that are made get their value from what goes into them; see valueCraftedItems. */
const add = (i: Omit<Item, 'value'> & { value?: number }) => {
  ITEMS[i.id] = { value: 0, ...i };
};
/** Shop values of what is gathered or dropped, by tier. */
const ORE_VALUES = [0, 6, 15, 32, 60, 110];
const LOG_VALUES = [0, 5, 12, 28, 52, 95];
const HIDE_VALUES = [0, 8, 20, 40, 75, 140];
const FIBRE_VALUES = [0, 4, 10, 22, 45, 85];
const GEM_VALUES = [0, 30, 80, 180, 350, 700];
const FISH_VALUES = [0, 4, 11, 25, 48, 90];
const WORN_VALUE = 10;
const WORLD_UNIQUE_VALUE = 150_000;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export interface Recipe {
  id: string;
  out: string;
  qty: number;
  station: Station;
  skill: Skill;
  level: number;
  xp: number;
  in: [string, number][];
  /** Cooking only: the level from which it never burns. */
  safe?: number;
  /** Cooking only: ticks on the fire until it is done. */
  ready?: number;
}
export type Station = 'furnace' | 'anvil' | 'workbench' | 'fire';
export const RECIPES: Recipe[] = [];
const recipe = (
  out: string,
  station: Station,
  skill: Skill,
  level: number,
  xp: number,
  inp: [string, number][],
  qty = 1,
) => RECIPES.push({ id: out, out, qty, station, skill, level, xp, in: inp });

add({
  id: 'worn_pickaxe',
  name: 'Worn pickaxe',
  icon: 'pickaxe',
  color: METAL_COLORS[0],
  tier: 0,
  tool: 'pickaxe',
  value: WORN_VALUE,
  basic: true,
});
add({
  id: 'worn_axe',
  name: 'Worn axe',
  icon: 'axe',
  color: METAL_COLORS[0],
  tier: 0,
  tool: 'axe',
  value: WORN_VALUE,
  basic: true,
});
add({
  id: 'worn_rod',
  name: 'Worn fishing rod',
  icon: 'rod',
  color: WOOD_COLORS[0],
  tier: 0,
  tool: 'rod',
  value: WORN_VALUE,
  basic: true,
});
add({
  id: 'worn_sword',
  name: 'Worn sword',
  icon: 'sword',
  color: METAL_COLORS[0],
  tier: 0,
  slot: 'weapon',
  style: 'melee',
  acc: 2,
  power: 2,
  speed: 4,
  range: 1,
  value: WORN_VALUE,
  basic: true,
});
add({ id: 'coin', name: 'Coins', icon: 'coin', color: '#d9b25b', tier: 1, stack: true, value: 1 });
add({
  id: 'essence',
  name: 'Essence',
  icon: 'essence',
  color: '#8fb8d8',
  tier: 1,
  stack: true,
  slot: 'ammo',
  ammo: 'essence',
  value: 2,
});
add({ id: 'berries', name: 'Berries', icon: 'berries', color: '#a8485e', tier: 1, heal: 4, value: 3 });
add({ id: 'meat', name: 'Raw meat', icon: 'meat', color: '#b0625a', tier: 1, value: 4 });
add({ id: 'cooked_meat', name: 'Cooked meat', icon: 'meat', color: '#8a5a3a', tier: 1, heal: 8 });
add({ id: 'ration', name: 'Trail ration', icon: 'ration', color: '#b58a58', tier: 1, heal: 12 });
add({ id: 'feast', name: 'Hearty feast', icon: 'ration', color: '#d0a060', tier: 3, heal: 26 });
add({ id: 'ships_wheel', name: "Ship's wheel", icon: 'wheel', color: '#8d7a5e', tier: 1, value: 50 });

/**
 * Cooking: food burns less often as the level rises, and never once it is this many levels above the recipe's, or at
 * the last level.
 */
export const COOKING = {
  safeAfter: 20,
  /** What burnt food becomes. It is worth nothing. */
  burnt: 'burnt_food',
  /** Ticks on the fire until the first food is done; food of higher levels takes longer. */
  readyTicks: 4,
  readyPerLevels: 20,
};
add({ id: COOKING.burnt, name: 'Burnt food', icon: 'meat', color: '#3a302c', tier: 1, value: 0 });
/** Everything about cooking a dish follows from its level, so that a new one is a single line. */
const cook = (out: string, level: number, xp: number, inp: [string, number][]) =>
  RECIPES.push({
    id: out,
    out,
    qty: 1,
    station: 'fire',
    skill: 'cooking',
    level,
    xp,
    in: inp,
    // A dish of a high level still stops burning before the last level.
    safe: Math.min(level + COOKING.safeAfter, MAX_LEVEL),
    ready: COOKING.readyTicks + Math.floor(level / COOKING.readyPerLevels),
  });
cook('cooked_meat', 1, 35, [['meat', 1]]);
cook('ration', 1, 52, [
  ['meat', 1],
  ['berries', 1],
]);
cook('feast', 25, 155, [
  ['meat', 2],
  ['berries', 2],
]);
/** Cooked fish, by tier: what it heals and the experience of cooking it. Its level is the fish's fishing level. */
const FISH_HEAL = [0, 6, 10, 15, 20, 25];
const FISH_COOKING_XP = [0, 30, 50, 65, 120, 140];
const COOKED_FISH_COLORS = ['', '#b7a070', '#c49070', '#a89a70', '#e0a080', '#a89080'];
for (let t = 1; t <= 5; t++) {
  add({
    id: `cooked_${FISH[t]}`,
    name: `Cooked ${FISH[t]}`,
    icon: 'fish',
    color: COOKED_FISH_COLORS[t],
    tier: t,
    heal: FISH_HEAL[t],
  });
  cook(`cooked_${FISH[t]}`, TIER_LEVEL[t], FISH_COOKING_XP[t], [[`raw_${FISH[t]}`, 1]]);
}

for (let t = 1; t <= 5; t++) {
  const m = METALS[t],
    w = WOODS[t],
    L = TIER_LEVEL[t],
    X = TIER_XP[t];
  const M = cap(m),
    W = cap(w),
    mc = METAL_COLORS[t],
    wc = WOOD_COLORS[t];
  const lv = (o: number) => L + o;
  add({ id: `${m}_ore`, name: `${M} ore`, icon: 'ore', color: mc, tier: t, value: ORE_VALUES[t] });
  add({ id: `${m}_bar`, name: `${M} bar`, icon: 'bar', color: mc, tier: t });
  add({ id: `${w}_log`, name: `${W} log`, icon: 'log', color: wc, tier: t, value: LOG_VALUES[t] });
  add({
    id: `raw_${FISH[t]}`,
    name: `Raw ${FISH[t]}`,
    icon: 'fish',
    color: FISH_COLORS[t],
    tier: t,
    value: FISH_VALUES[t],
  });
  add({
    id: `${m}_pickaxe`,
    name: `${M} pickaxe`,
    icon: 'pickaxe',
    color: mc,
    tier: t,
    tool: 'pickaxe',
    req: { mining: L },
  });
  add({
    id: `${m}_axe`,
    name: `${M} axe`,
    icon: 'axe',
    color: mc,
    tier: t,
    tool: 'axe',
    req: { woodcutting: L },
  });
  add({
    id: `${m}_sword`,
    name: `${M} sword`,
    icon: 'sword',
    color: mc,
    tier: t,
    slot: 'weapon',
    style: 'melee',
    acc: t * 8,
    power: t * 8,
    speed: 4,
    range: 1,
    req: { melee: L },
  });
  add({
    id: `${m}_helm`,
    name: `${M} helm`,
    icon: 'helm',
    color: mc,
    tier: t,
    slot: 'head',
    armour: t * 4,
    req: { defence: L },
  });
  add({
    id: `${m}_plate`,
    name: `${M} plate`,
    icon: 'body',
    color: mc,
    tier: t,
    slot: 'body',
    armour: t * 8,
    req: { defence: L },
  });
  add({
    id: `${m}_greaves`,
    name: `${M} greaves`,
    icon: 'legs',
    color: mc,
    tier: t,
    slot: 'legs',
    armour: t * 6,
    req: { defence: L },
  });
  add({ id: `${m}_arrowhead`, name: `${M} arrowhead`, icon: 'arrowhead', color: mc, tier: t, stack: true });
  add({ id: `${w}_shaft`, name: `${W} shaft`, icon: 'shaft', color: wc, tier: t, stack: true });
  add({
    id: `${m}_arrow`,
    name: `${M} arrow`,
    icon: 'arrow',
    color: mc,
    tier: t,
    stack: true,
    slot: 'ammo',
    ammo: 'arrow',
    power: t * 3,
  });
  add({
    id: `${w}_bow`,
    name: `${W} bow`,
    icon: 'bow',
    color: wc,
    tier: t,
    slot: 'weapon',
    style: 'ranged',
    acc: t * 8,
    power: t * 5,
    speed: 4,
    range: 6,
    req: { ranged: L },
  });
  add({
    id: `${w}_staff`,
    name: `${W} staff`,
    icon: 'staff',
    color: wc,
    tier: t,
    slot: 'weapon',
    style: 'magic',
    acc: t * 9,
    power: t * 9,
    speed: 5,
    range: 6,
    req: { magic: L },
  });
  add({
    id: `hide_${t}`,
    name: `${HIDES[t]} hide`,
    icon: 'hide',
    color: HIDE_COLORS[t],
    tier: t,
    value: HIDE_VALUES[t],
  });
  add({
    id: `fibre_${t}`,
    name: FIBRES[t],
    icon: 'fibre',
    color: FIBRE_COLORS[t],
    tier: t,
    value: FIBRE_VALUES[t],
  });
  add({ id: `gem_${t}`, name: GEMS[t], icon: 'gem', color: GEM_COLORS[t], tier: t, value: GEM_VALUES[t] });
  add({
    id: `amulet_${t}`,
    name: `${GEMS[t]} amulet`,
    icon: 'amulet',
    color: GEM_COLORS[t],
    tier: t,
    slot: 'neck',
    acc: t * 3,
    power: t,
    req: { vitality: L },
  });
  for (const [p, name, ic, slot, n, ar] of [
    ['cowl', 'cowl', 'helm', 'head', 2, 2],
    ['jerkin', 'jerkin', 'body', 'body', 4, 5],
    ['chaps', 'chaps', 'legs', 'legs', 3, 4],
  ] as const) {
    add({
      id: `leather_${p}_${t}`,
      name: `${HIDES[t]} ${name}`,
      icon: ic,
      color: HIDE_COLORS[t],
      tier: t,
      slot,
      armour: t * ar,
      acc: t * 2,
      req: { ranged: L },
    });
    recipe(`leather_${p}_${t}`, 'workbench', 'crafting', lv(n - 1), X * n, [[`hide_${t}`, n]]);
  }
  for (const [p, name, ic, slot, n, ar] of [
    ['hood', 'hood', 'helm', 'head', 2, 1],
    ['robe', 'robe', 'body', 'body', 4, 4],
    ['skirt', 'wrap', 'legs', 'legs', 3, 3],
  ] as const) {
    add({
      id: `cloth_${p}_${t}`,
      name: `${FIBRES[t]} ${name}`,
      icon: ic,
      color: FIBRE_COLORS[t],
      tier: t,
      slot,
      armour: t * ar,
      power: t,
      req: { magic: L },
    });
    recipe(`cloth_${p}_${t}`, 'workbench', 'crafting', lv(n - 1), X * n, [[`fibre_${t}`, n]]);
  }
  recipe(`${m}_bar`, 'furnace', 'smithing', L, X, [[`${m}_ore`, 2]]);
  recipe(`${m}_pickaxe`, 'anvil', 'smithing', lv(0), X * 2, [
    [`${m}_bar`, 2],
    [`${w}_log`, 1],
  ]);
  recipe(`${m}_axe`, 'anvil', 'smithing', lv(0), X * 2, [
    [`${m}_bar`, 2],
    [`${w}_log`, 1],
  ]);
  recipe(`${m}_sword`, 'anvil', 'smithing', lv(1), X * 2, [
    [`${m}_bar`, 3],
    [`${w}_log`, 1],
  ]);
  recipe(`${m}_arrowhead`, 'anvil', 'smithing', lv(1), X, [[`${m}_bar`, 1]], 15);
  recipe(`${m}_helm`, 'anvil', 'smithing', lv(2), X * 3, [[`${m}_bar`, 3]]);
  recipe(`${m}_greaves`, 'anvil', 'smithing', lv(3), X * 4, [[`${m}_bar`, 4]]);
  recipe(`${m}_plate`, 'anvil', 'smithing', lv(4), X * 5, [[`${m}_bar`, 5]]);
  recipe(`${w}_shaft`, 'workbench', 'crafting', lv(0), X * 0.6, [[`${w}_log`, 1]], 15);
  recipe(
    `${m}_arrow`,
    'workbench',
    'crafting',
    lv(0),
    X * 0.6,
    [
      [`${m}_arrowhead`, 15],
      [`${w}_shaft`, 15],
    ],
    15,
  );
  recipe(`${w}_bow`, 'workbench', 'crafting', lv(1), X * 2, [
    [`${w}_log`, 3],
    [`fibre_${t}`, 1],
  ]);
  recipe(`${w}_staff`, 'workbench', 'crafting', lv(1), X * 2, [
    [`${w}_log`, 3],
    ['essence', 10],
  ]);
  recipe(`amulet_${t}`, 'workbench', 'crafting', lv(4), X * 3, [
    [`gem_${t}`, 1],
    [`fibre_${t}`, 1],
  ]);
}
// Uniques
add({
  id: 'barnacle_charm',
  name: 'Barnacle charm',
  icon: 'amulet',
  color: '#7fb5a8',
  tier: 1,
  slot: 'neck',
  acc: 6,
  power: 3,
  armour: 4,
  value: 2500,
  unique: true,
});
add({
  id: 'rootcleaver',
  name: 'Rootcleaver',
  icon: 'sword',
  color: '#9fc36a',
  tier: 5,
  slot: 'weapon',
  style: 'melee',
  acc: 48,
  power: 50,
  speed: 4,
  range: 1,
  req: { melee: 40 },
  value: WORLD_UNIQUE_VALUE,
  unique: true,
});
add({
  id: 'briarstring',
  name: 'Briarstring',
  icon: 'bow',
  color: '#9fc36a',
  tier: 5,
  slot: 'weapon',
  style: 'ranged',
  acc: 48,
  power: 34,
  speed: 4,
  range: 7,
  req: { ranged: 40 },
  value: WORLD_UNIQUE_VALUE,
  unique: true,
});
add({
  id: 'heartwood',
  name: 'Heartwood staff',
  icon: 'staff',
  color: '#9fc36a',
  tier: 5,
  slot: 'weapon',
  style: 'magic',
  acc: 52,
  power: 56,
  speed: 5,
  range: 7,
  req: { magic: 40 },
  value: WORLD_UNIQUE_VALUE,
  unique: true,
});

// Trophies
const CAPE_COLORS: Record<Skill, string> = {
  mining: '#8c8478',
  smithing: '#c0643c',
  woodcutting: '#5f8a4a',
  fishing: '#3f86a8',
  crafting: '#b08a4e',
  cooking: '#c4703a',
  melee: '#a8413c',
  ranged: '#3f7d62',
  magic: '#4a62b0',
  defence: '#6d7f94',
  vitality: '#b0577f',
};
/** Worn for show by whoever has mastered a skill. */
for (const skill of SKILLS)
  add({
    id: `cape_${skill}`,
    name: `${cap(skill)} cape`,
    icon: 'cape',
    color: CAPE_COLORS[skill],
    tier: 5,
    slot: 'cape',
    req: { [skill]: 50 },
    value: 1,
    trophy: true,
  });
add({
  id: 'rooted_mantle',
  name: 'Rooted mantle',
  icon: 'cape',
  color: '#6f9048',
  tier: 5,
  slot: 'cape',
  value: 1,
  unique: true,
  trophy: true,
});

add({
  id: 'stoneheart',
  name: 'Stoneheart',
  icon: 'amulet',
  color: '#8fa3ad',
  tier: 3,
  slot: 'neck',
  acc: 10,
  power: 6,
  armour: 10,
  req: { vitality: 25 },
  value: 20_000,
  unique: true,
});
add({
  id: 'genie_lamp',
  name: "Genie's lamp",
  icon: 'lamp',
  color: '#d9b25b',
  tier: 1,
  value: 1,
  bound: true,
});

// Resource nodes
export interface NodeDef {
  id: string;
  name: string;
  kind: 'rock' | 'tree' | 'plant' | 'spot';
  tier: number;
  skill: Skill | null;
  level: number;
  xp: number;
  item: string;
  tool?: Tool;
  /** Skill level that counts as a beginner's, which decides how often an attempt succeeds. */
  difficulty: number;
  /** Ticks between attempts. */
  interval: number;
  respawn: number;
  /** Chance to run out with every item. */
  deplete: number;
  /** Width in tiles. */
  size: number;
  /** Whether one of a group of these glows at times. */
  glows: boolean;
  /** Instead of running out, it moves to another place of its group. Only some places hold it at a time. */
  moves?: boolean;
  color: string;
}
/** Methods beyond the basic one. */
export const METHODS = {
  /** Skill level from which they work. */
  level: 15,
  /** How long one node of a group glows. */
  glowTicks: 12,
  /** Experience of the first strike on a glowing node, as a multiple of the usual. */
  glowBonus: 1.5,
  /** Fewer than this many nodes together do not glow. */
  glowGroup: 4,
};
const WORK_INTERVAL = 3;
const BIG_ROCK_INTERVAL = WORK_INTERVAL * 3;
/** Higher trees give more logs before they fall, and take longer for each. */
const LOGS_PER_TREE = [0, 4, 6, 8, 11, 15];
const CHOP_INTERVALS = [0, 3, 6, 9, 11, 12];
export const NODES: Record<string, NodeDef> = {};
for (let t = 1; t <= 5; t++) {
  NODES[`rock_${t}`] = {
    id: `rock_${t}`,
    name: `${cap(METALS[t])} rock`,
    kind: 'rock',
    tier: t,
    skill: 'mining',
    level: TIER_LEVEL[t],
    difficulty: TIER_LEVEL[t],
    xp: TIER_XP[t],
    item: `${METALS[t]}_ore`,
    tool: 'pickaxe',
    interval: WORK_INTERVAL,
    respawn: 4 + t * 4,
    deplete: 0.5,
    size: 1,
    glows: true,
    color: METAL_COLORS[t],
  };
  NODES[`tree_${t}`] = {
    id: `tree_${t}`,
    name: `${cap(WOODS[t])} tree`,
    kind: 'tree',
    tier: t,
    skill: 'woodcutting',
    level: TIER_LEVEL[t],
    difficulty: TIER_LEVEL[t],
    xp: TIER_XP[t],
    item: `${WOODS[t]}_log`,
    tool: 'axe',
    interval: CHOP_INTERVALS[t],
    respawn: 6 + t * 5,
    deplete: 1 / LOGS_PER_TREE[t],
    size: 1,
    glows: true,
    color: WOOD_COLORS[t],
  };
  NODES[`plant_${t}`] = {
    id: `plant_${t}`,
    name: FIBRES[t],
    kind: 'plant',
    tier: t,
    skill: 'crafting',
    level: TIER_LEVEL[t],
    difficulty: TIER_LEVEL[t],
    xp: TIER_XP[t] * 0.4,
    item: `fibre_${t}`,
    interval: WORK_INTERVAL,
    respawn: 6 + t * 3,
    deplete: 0.6,
    size: 1,
    glows: false,
    color: FIBRE_COLORS[t],
  };
}
NODES.essence_rock = {
  id: 'essence_rock',
  name: 'Essence rock',
  kind: 'rock',
  tier: 1,
  skill: 'mining',
  level: 1,
  difficulty: 1,
  xp: 15,
  item: 'essence',
  tool: 'pickaxe',
  interval: WORK_INTERVAL,
  respawn: 8,
  deplete: 0.1,
  size: 1,
  glows: false,
  color: '#8fb8d8',
};
NODES.berry_bush = {
  id: 'berry_bush',
  name: 'Berry bush',
  kind: 'plant',
  tier: 1,
  skill: null,
  level: 1,
  difficulty: 1,
  xp: 0,
  item: 'berries',
  interval: WORK_INTERVAL,
  respawn: 12,
  deplete: 0.4,
  size: 1,
  glows: false,
  color: '#a8485e',
};
/** Slow, but never runs out. */
function addBigRock(id: string, of: NodeDef) {
  NODES[id] = {
    ...of,
    id,
    name: `Big ${of.name.toLowerCase()}`,
    level: Math.max(METHODS.level, of.level),
    interval: BIG_ROCK_INTERVAL,
    deplete: 0,
    size: 2,
    glows: false,
  };
}
for (let t = 1; t <= 5; t++) addBigRock(`big_rock_${t}`, NODES[`rock_${t}`]);
addBigRock('big_essence_rock', NODES.essence_rock);

/** Catches before a fishing spot moves along the shore. */
const CATCHES_PER_SPOT = 5;
/**
 * Levels a worn rod catches as if they were more, as many as a tool of the spot's tier would add, until rods
 * come by tier. Each tier of tool adds what 5⅓ levels add (`GatherChance` in formulas.go).
 */
const ROD_LEVELS_PER_TIER = 0.08 / 0.015;
for (let t = 1; t <= 5; t++) {
  const fish = cap(FISH[t]);
  NODES[`spot_${t}`] = {
    id: `spot_${t}`,
    name: `${fish} spot`,
    kind: 'spot',
    tier: t,
    skill: 'fishing',
    level: TIER_LEVEL[t],
    difficulty: TIER_LEVEL[t] - Math.round(t * ROD_LEVELS_PER_TIER),
    xp: TIER_XP[t],
    item: `raw_${FISH[t]}`,
    tool: 'rod',
    interval: WORK_INTERVAL,
    respawn: 0,
    deplete: 1 / CATCHES_PER_SPOT,
    size: 1,
    glows: true,
    moves: true,
    color: FISH_COLORS[t],
  };
  // The big rock of fishing: slow, and it never moves.
  NODES[`shoal_${t}`] = {
    ...NODES[`spot_${t}`],
    id: `shoal_${t}`,
    name: `${fish} shoal`,
    level: Math.max(METHODS.level, TIER_LEVEL[t]),
    interval: BIG_ROCK_INTERVAL,
    deplete: 0,
    size: 2,
    glows: false,
    moves: false,
  };
}

// Loot: every guaranteed entry, plus one weighted common, plus independent rare and unique chances.
export interface LootTable {
  always?: [string, number, number][];
  common?: [string, number, number][];
  rare?: [string, number, number][];
  unique?: [string, number][];
}
export interface MonsterDef {
  id: string;
  name: string;
  style: Style;
  level: number;
  hp: number;
  acc: number;
  power: number;
  armour: number;
  speed: number;
  range: number;
  aggro: number;
  respawn: number;
  size: number;
  color: string;
  shape: 'beast' | 'bird' | 'wisp' | 'plant' | 'golem' | 'crab' | 'treant';
  /** Another monster whose model it shares. */
  looksLike?: string;
  /** Only comes with a stampede. */
  herd?: boolean;
  loot: LootTable;
  boss?: BossDef;
}
/** How an attack marks ground. Melee marks none: it has a target. */
export const BOSS_SHAPES = ['square', 'cross', 'rings', 'side', 'sides', 'line'] as const;
export type BossShape = (typeof BOSS_SHAPES)[number];
export interface BossAttack {
  /** Chooses the damage text, the name and the pose; the shape says where and when it hits. */
  id: 'melee' | 'boulder' | 'vines' | 'quake' | 'snap' | 'double_snap' | 'jet';
  shape?: BossShape;
  name: string;
  weight: number;
  windup: number;
  execute: number;
  damage: [number, number];
  root?: number;
  count?: number;
}
export interface BossDef {
  baseHp: number;
  /** Share of full health healed per second. */
  regen: number;
  arena: number;
  world: boolean;
  attacks: BossAttack[];
}
export const MONSTERS: Record<string, MonsterDef> = {};
const mon = (
  d: Omit<MonsterDef, 'acc' | 'power' | 'armour' | 'speed' | 'range' | 'respawn' | 'size'> &
    Partial<MonsterDef>,
) => {
  MONSTERS[d.id] = {
    acc: d.level,
    power: d.level * 0.9,
    armour: d.level * 0.6,
    speed: 5,
    range: d.style === 'melee' ? 1 : 5,
    respawn: 15,
    size: 1,
    ...d,
  };
};
mon({
  id: 'chicken',
  name: 'Chicken',
  style: 'melee',
  level: 1,
  hp: 4,
  acc: 0,
  power: 0,
  aggro: 0,
  respawn: 10,
  color: '#e8dcc4',
  shape: 'bird',
  loot: { always: [['coin', 1, 4]], rare: [['meat', 1, 0.4]] },
});
mon({
  id: 'boar',
  name: 'Meadow boar',
  style: 'melee',
  level: 1,
  hp: 12,
  aggro: 0,
  color: '#8d6a4c',
  shape: 'beast',
  loot: {
    always: [
      ['hide_1', 1, 1],
      ['meat', 1, 1],
    ],
  },
});
mon({
  id: 'spitter',
  name: 'Thorn spitter',
  style: 'ranged',
  level: 3,
  hp: 14,
  aggro: 0,
  color: '#6e9a58',
  shape: 'plant',
  loot: { always: [['fibre_1', 1, 2]], rare: [['gem_1', 1, 0.1]] },
});
mon({
  id: 'wisp',
  name: 'Pale wisp',
  style: 'magic',
  level: 5,
  hp: 18,
  aggro: 0,
  color: '#a9c4d8',
  shape: 'wisp',
  loot: { always: [['essence', 3, 8]], rare: [['gem_1', 1, 0.15]] },
});
mon({
  id: 'wolf',
  name: 'Ridge wolf',
  style: 'melee',
  level: 12,
  hp: 38,
  aggro: 4,
  color: '#6f7680',
  shape: 'beast',
  loot: {
    always: [
      ['hide_2', 1, 1],
      ['meat', 1, 2],
    ],
    rare: [['gem_2', 1, 0.05]],
  },
});
mon({
  id: 'marshwisp',
  name: 'Marsh wisp',
  style: 'magic',
  level: 15,
  hp: 42,
  aggro: 0,
  color: '#8fc7a0',
  shape: 'wisp',
  loot: { always: [['essence', 8, 16]], rare: [['gem_2', 1, 0.15]] },
});
mon({
  id: 'thornback',
  name: 'Thornback',
  style: 'ranged',
  level: 22,
  hp: 65,
  aggro: 4,
  color: '#6e7b4a',
  shape: 'beast',
  loot: {
    always: [
      ['hide_3', 1, 2],
      ['meat', 1, 2],
    ],
    rare: [['gem_3', 1, 0.05]],
  },
});
mon({
  id: 'golem',
  name: 'Stone golem',
  style: 'melee',
  level: 26,
  hp: 85,
  aggro: 3,
  color: '#85827a',
  shape: 'golem',
  loot: {
    common: [
      ['mithril_ore', 1, 3],
      ['iron_bar', 1, 2],
    ],
    rare: [['gem_3', 1, 0.15]],
  },
});
mon({
  id: 'drake',
  name: 'Storm drake',
  style: 'magic',
  level: 32,
  hp: 110,
  aggro: 5,
  color: '#5c6f8c',
  shape: 'beast',
  loot: {
    always: [['hide_4', 1, 2]],
    common: [
      ['essence', 10, 25],
      ['meat', 1, 3],
    ],
    rare: [['gem_4', 1, 0.08]],
  },
});
mon({
  id: 'stalker',
  name: 'Cragstalker',
  style: 'ranged',
  level: 36,
  hp: 125,
  aggro: 5,
  color: '#a8573a',
  shape: 'plant',
  loot: {
    common: [
      ['cobalt_arrow', 8, 20],
      ['fibre_4', 1, 3],
    ],
    rare: [['gem_4', 1, 0.15]],
  },
});
mon({
  id: 'stag',
  name: 'Dread stag',
  style: 'melee',
  level: 42,
  hp: 160,
  aggro: 5,
  color: '#6b4456',
  shape: 'beast',
  loot: {
    always: [
      ['hide_5', 1, 2],
      ['meat', 1, 3],
    ],
    rare: [['gem_5', 1, 0.06]],
  },
});
mon({
  id: 'seer',
  name: 'Hollow seer',
  style: 'magic',
  level: 46,
  hp: 180,
  aggro: 5,
  color: '#8a6cae',
  shape: 'wisp',
  loot: { always: [['essence', 15, 30]], rare: [['gem_5', 1, 0.15]] },
});
mon({
  id: 'gnashclaw',
  name: 'Old Gnashclaw',
  style: 'melee',
  level: 8,
  hp: 90,
  aggro: 0,
  respawn: 60,
  size: 3,
  color: '#b5604a',
  shape: 'crab',
  loot: {
    always: [
      ['ships_wheel', 1, 1],
      ['coin', 40, 80],
    ],
    common: [
      ['meat', 2, 4],
      ['essence', 15, 30],
      ['iron_ore', 2, 4],
    ],
    rare: [
      ['gem_1', 1, 0.3],
      ['gem_2', 1, 0.1],
    ],
    unique: [['barnacle_charm', 1 / 50]],
  },
  boss: {
    baseHp: 90,
    regen: 0.002,
    arena: 9,
    world: false,
    attacks: [
      { id: 'snap', shape: 'side', name: 'Snap', weight: 5, windup: 3, execute: 2, damage: [8, 12] },
      {
        id: 'double_snap',
        shape: 'sides',
        name: 'Double snap',
        weight: 2,
        windup: 5,
        execute: 2,
        damage: [12, 16],
      },
      { id: 'jet', shape: 'line', name: 'Water jet', weight: 3, windup: 4, execute: 2, damage: [9, 14] },
    ],
  },
});
mon({
  id: 'deepstone',
  name: 'Deepstone',
  style: 'melee',
  level: 32,
  hp: 320,
  aggro: 0,
  respawn: 120,
  size: 2,
  color: '#6f7480',
  shape: 'golem',
  loot: {
    always: [
      ['mithril_ore', 3, 6],
      ['coin', 200, 400],
    ],
    common: [
      ['cobalt_ore', 2, 4],
      ['mithril_bar', 1, 3],
      ['feast', 1, 2],
    ],
    rare: [
      ['gem_3', 1, 0.3],
      ['gem_4', 1, 0.1],
    ],
    unique: [['stoneheart', 1 / 100]],
  },
  boss: {
    baseHp: 320,
    regen: 0.002,
    arena: 7,
    world: false,
    attacks: [
      { id: 'melee', name: 'Fist', weight: 4, windup: 4, execute: 1, damage: [12, 20] },
      {
        id: 'boulder',
        shape: 'square',
        name: 'Falling rock',
        weight: 3,
        windup: 5,
        execute: 2,
        damage: [22, 32],
        count: 2,
      },
      { id: 'quake', shape: 'rings', name: 'Tremor', weight: 3, windup: 6, execute: 2, damage: [16, 26] },
    ],
  },
});
mon({
  id: 'stampede_boar',
  name: 'Stampeding boar',
  style: 'melee',
  level: 14,
  hp: 45,
  aggro: 2,
  color: '#6d5138',
  shape: 'beast',
  looksLike: 'boar',
  herd: true,
  loot: { always: [['hide_2', 1, 2]], common: [['meat', 1, 3]] },
});
mon({
  id: 'stampede_leader',
  name: 'Great tusker',
  style: 'melee',
  level: 24,
  hp: 160,
  aggro: 3,
  color: '#4a3a34',
  shape: 'beast',
  looksLike: 'boar',
  herd: true,
  loot: {
    always: [
      ['hide_3', 3, 5],
      ['coin', 120, 240],
    ],
    rare: [['gem_3', 1, 0.3]],
  },
});
mon({
  id: 'colossus',
  name: 'Orrumax, the Rooted',
  style: 'melee',
  level: 45,
  hp: 900,
  aggro: 0,
  respawn: 600,
  size: 3,
  color: '#5d6b45',
  shape: 'treant',
  loot: {
    // A tree gives wood and what grows on it.
    always: [
      ['coin', 1500, 3000],
      ['maple_log', 4, 8],
      ['feast', 1, 2],
    ],
    common: [
      ['ebony_log', 3, 6],
      ['fibre_5', 3, 6],
      ['fibre_4', 5, 9],
      ['ebony_shaft', 60, 120],
    ],
    rare: [
      ['gem_5', 1, 0.25],
      ['amulet_5', 1, 0.05],
    ],
    unique: [
      ['rootcleaver', 1 / 400],
      ['briarstring', 1 / 400],
      ['heartwood', 1 / 400],
      ['rooted_mantle', 1 / 1000],
    ],
  },
  boss: {
    baseHp: 900,
    regen: 0.002,
    arena: 12,
    world: true,
    attacks: [
      { id: 'melee', name: 'Crushing limb', weight: 3, windup: 2, execute: 1, damage: [14, 24] },
      {
        id: 'boulder',
        shape: 'square',
        name: 'Falling boulder',
        weight: 4,
        windup: 5,
        execute: 2,
        damage: [28, 42],
        count: 5,
      },
      {
        id: 'vines',
        shape: 'cross',
        name: 'Creeping vines',
        weight: 3,
        windup: 6,
        execute: 2,
        damage: [8, 14],
        root: 5,
        count: 5,
      },
      { id: 'quake', shape: 'rings', name: 'Root quake', weight: 2, windup: 4, execute: 2, damage: [24, 36] },
    ],
  },
});

/** Ordinary monsters carry coins according to their level. */
const carryCoins = ({ level, loot }: MonsterDef) => {
  loot.always = [...(loot.always ?? []), ['coin', Math.ceil(level * 0.6), level * 2]];
};
for (const monster of Object.values(MONSTERS))
  if (!monster.boss && monster.id !== 'chicken') carryCoins(monster);

/** Making something adds a fifth to the value of what goes into it. */
const CRAFTING_MARKUP = 1.2;
function valueCraftedItems() {
  const unvalued = () => RECIPES.filter(r => !ITEMS[r.out].value && r.in.every(([id]) => ITEMS[id].value));
  for (let ready = unvalued(); ready.length; ready = unvalued())
    for (const { out, qty, in: inputs } of ready) {
      const cost = inputs.reduce((sum, [id, n]) => sum + ITEMS[id].value * n, 0);
      ITEMS[out].value = Math.max(1, Math.round((cost * CRAFTING_MARKUP) / qty));
    }
}
valueCraftedItems();

/** Percentages are of an item's shop value. */
export const ECONOMY = {
  shopStock: ['worn_pickaxe', 'worn_axe', 'worn_rod', 'worn_sword'],
  sellPercent: 50,
  graveFeePercent: 5,
  reaperFeePercent: 10,
};

export interface Look {
  cut: number;
  color: number;
}
export const HAIRCUTS = [
  { id: 'quiff', name: 'Quiff' },
  { id: 'crop', name: 'Textured crop' },
  { id: 'sidepart', name: 'Side part' },
  { id: 'curls', name: 'Curly top' },
] as const;
export const HAIR_COLORS = [
  { name: 'Brown', color: '#7a5236' },
  { name: 'Chestnut', color: '#9c6b40' },
  { name: 'Dark brown', color: '#4a3a32' },
  { name: 'Copper', color: '#a5603c' },
  { name: 'Blond', color: '#c9a468' },
  { name: 'Black', color: '#2c2a2e' },
  { name: 'Ash', color: '#8f8a84' },
  { name: 'Platinum', color: '#ddd3bf' },
] as const;
export const nameHash = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return h;
};
/** What a character looks like until its player chooses. */
export const defaultLook = (name: string): Look => {
  const h = nameHash(name);
  return { cut: (h >> 5) % HAIRCUTS.length, color: (h >> 2) % 5 };
};
export const BOAT_PARTS: { id: string; name: string; item: string; qty: number }[] = [
  { id: 'hull', name: 'Ash hull', item: 'ash_log', qty: 20 },
  { id: 'fittings', name: 'Copper fittings', item: 'copper_bar', qty: 8 },
  { id: 'sail', name: 'Flax sail', item: 'fibre_1', qty: 12 },
  { id: 'wheel', name: "Ship's wheel", item: 'ships_wheel', qty: 1 },
];
