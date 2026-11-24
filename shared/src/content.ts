export const GAME_NAME = 'Magicka'; // working title; rename here before any public launch
export const SKILLS = ['mining', 'smithing', 'woodcutting', 'crafting', 'melee', 'ranged', 'magic', 'defence', 'vitality'] as const;
export type Skill = (typeof SKILLS)[number];
export type Style = 'melee' | 'ranged' | 'magic';
export const SLOTS = ['weapon', 'head', 'body', 'legs', 'neck', 'ammo'] as const;
export type Slot = (typeof SLOTS)[number];
export const INV_SIZE = 24;
export const TIER_LEVEL = [1, 1, 10, 20, 30, 40];
export const TIER_XP = [0, 25, 45, 75, 120, 180];
export const METALS = ['', 'copper', 'iron', 'mithril', 'cobalt', 'adamantite'];
export const WOODS = ['', 'ash', 'pine', 'oak', 'maple', 'ebony'];
const HIDES = ['', 'Soft', 'Thick', 'Thorned', 'Storm', 'Dread'];
const FIBRES = ['', 'Flax', 'Silkgrass', 'Moonreed', 'Frostvine', 'Nightbloom'];
const GEMS = ['', 'Quartz', 'Topaz', 'Garnet', 'Opal', 'Beryl'];
export const METAL_COLORS = ['#8a8378', '#c27c4e', '#9aa1a8', '#7f9fd1', '#3f6fb5', '#5fa08a'];
export const WOOD_COLORS = ['#8a7a60', '#c4a878', '#b98d56', '#8f6a3f', '#a8573a', '#3d3238'];
const HIDE_COLORS = ['', '#b98f66', '#8d6a4c', '#6e7b4a', '#5c6f8c', '#6b4456'];
const FIBRE_COLORS = ['', '#d7c98f', '#a8c27a', '#a9b6d6', '#8fc7cf', '#8a6cae'];
const GEM_COLORS = ['', '#dfe3e6', '#e0a640', '#a83b4b', '#b9d6d0', '#4fb38a'];

export interface Item {
  id: string; name: string; icon: string; color: string; tier: number; stack?: boolean;
  slot?: Slot; style?: Style; acc?: number; power?: number; armour?: number; speed?: number; range?: number;
  req?: Partial<Record<Skill, number>>; tool?: 'pickaxe' | 'axe'; ammo?: 'arrow' | 'essence'; heal?: number; unique?: boolean;
}
export const ITEMS: Record<string, Item> = {};
const add = (i: Item) => { ITEMS[i.id] = i; };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export interface Recipe { id: string; out: string; qty: number; station: Station; skill: Skill; level: number; xp: number; in: [string, number][]; }
export type Station = 'furnace' | 'anvil' | 'workbench';
export const RECIPES: Recipe[] = [];
const recipe = (out: string, station: Station, skill: Skill, level: number, xp: number, inp: [string, number][], qty = 1) =>
  RECIPES.push({ id: out, out, qty, station, skill, level, xp, in: inp });

add({ id: 'worn_pickaxe', name: 'Worn pickaxe', icon: 'pickaxe', color: METAL_COLORS[0], tier: 0, tool: 'pickaxe' });
add({ id: 'worn_axe', name: 'Worn axe', icon: 'axe', color: METAL_COLORS[0], tier: 0, tool: 'axe' });
add({ id: 'worn_sword', name: 'Worn sword', icon: 'sword', color: METAL_COLORS[0], tier: 0, slot: 'weapon', style: 'melee', acc: 2, power: 2, speed: 4, range: 1 });
add({ id: 'essence', name: 'Essence', icon: 'essence', color: '#8fb8d8', tier: 1, stack: true, slot: 'ammo', ammo: 'essence' });
add({ id: 'berries', name: 'Berries', icon: 'berries', color: '#a8485e', tier: 1, heal: 4 });
add({ id: 'meat', name: 'Raw meat', icon: 'meat', color: '#b0625a', tier: 1 });
add({ id: 'ration', name: 'Trail ration', icon: 'ration', color: '#b58a58', tier: 1, heal: 12 });
add({ id: 'feast', name: 'Hearty feast', icon: 'ration', color: '#d0a060', tier: 3, heal: 26 });
add({ id: 'rudder', name: 'Swallowed rudder', icon: 'rudder', color: '#8d7a5e', tier: 1 });
recipe('ration', 'workbench', 'crafting', 1, 12, [['meat', 1], ['berries', 1]]);
recipe('feast', 'workbench', 'crafting', 25, 60, [['meat', 2], ['berries', 2]]);

for (let t = 1; t <= 5; t++) {
  const m = METALS[t], w = WOODS[t], L = TIER_LEVEL[t], X = TIER_XP[t];
  const M = cap(m), W = cap(w), mc = METAL_COLORS[t], wc = WOOD_COLORS[t];
  const lv = (o: number) => L + o;
  add({ id: `${m}_ore`, name: `${M} ore`, icon: 'ore', color: mc, tier: t });
  add({ id: `${m}_bar`, name: `${M} bar`, icon: 'bar', color: mc, tier: t });
  add({ id: `${w}_log`, name: `${W} log`, icon: 'log', color: wc, tier: t });
  add({ id: `${m}_pickaxe`, name: `${M} pickaxe`, icon: 'pickaxe', color: mc, tier: t, tool: 'pickaxe', req: { mining: L } });
  add({ id: `${m}_axe`, name: `${M} axe`, icon: 'axe', color: mc, tier: t, tool: 'axe', req: { woodcutting: L } });
  add({ id: `${m}_sword`, name: `${M} sword`, icon: 'sword', color: mc, tier: t, slot: 'weapon', style: 'melee', acc: t * 8, power: t * 8, speed: 4, range: 1, req: { melee: L } });
  add({ id: `${m}_helm`, name: `${M} helm`, icon: 'helm', color: mc, tier: t, slot: 'head', armour: t * 4, req: { defence: L } });
  add({ id: `${m}_plate`, name: `${M} plate`, icon: 'body', color: mc, tier: t, slot: 'body', armour: t * 8, req: { defence: L } });
  add({ id: `${m}_greaves`, name: `${M} greaves`, icon: 'legs', color: mc, tier: t, slot: 'legs', armour: t * 6, req: { defence: L } });
  add({ id: `${m}_arrowhead`, name: `${M} arrowhead`, icon: 'arrowhead', color: mc, tier: t, stack: true });
  add({ id: `${w}_shaft`, name: `${W} shaft`, icon: 'shaft', color: wc, tier: t, stack: true });
  add({ id: `${m}_arrow`, name: `${M} arrow`, icon: 'arrow', color: mc, tier: t, stack: true, slot: 'ammo', ammo: 'arrow', power: t * 3 });
  add({ id: `${w}_bow`, name: `${W} bow`, icon: 'bow', color: wc, tier: t, slot: 'weapon', style: 'ranged', acc: t * 8, power: t * 5, speed: 4, range: 6, req: { ranged: L } });
  add({ id: `${w}_staff`, name: `${W} staff`, icon: 'staff', color: wc, tier: t, slot: 'weapon', style: 'magic', acc: t * 9, power: t * 9, speed: 5, range: 6, req: { magic: L } });
  add({ id: `hide_${t}`, name: `${HIDES[t]} hide`, icon: 'hide', color: HIDE_COLORS[t], tier: t });
  add({ id: `fibre_${t}`, name: FIBRES[t], icon: 'fibre', color: FIBRE_COLORS[t], tier: t });
  add({ id: `gem_${t}`, name: GEMS[t], icon: 'gem', color: GEM_COLORS[t], tier: t });
  add({ id: `amulet_${t}`, name: `${GEMS[t]} amulet`, icon: 'amulet', color: GEM_COLORS[t], tier: t, slot: 'neck', acc: t * 3, power: t, req: { vitality: L } });
  for (const [p, name, ic, slot, n, ar] of [['cowl', 'cowl', 'helm', 'head', 2, 2], ['jerkin', 'jerkin', 'body', 'body', 4, 5], ['chaps', 'chaps', 'legs', 'legs', 3, 4]] as const) {
    add({ id: `leather_${p}_${t}`, name: `${HIDES[t]} ${name}`, icon: ic, color: HIDE_COLORS[t], tier: t, slot, armour: t * ar, acc: t * 2, req: { ranged: L } });
    recipe(`leather_${p}_${t}`, 'workbench', 'crafting', lv(n - 1), X * n, [[`hide_${t}`, n]]);
  }
  for (const [p, name, ic, slot, n, ar] of [['hood', 'hood', 'helm', 'head', 2, 1], ['robe', 'robe', 'body', 'body', 4, 4], ['skirt', 'wrap', 'legs', 'legs', 3, 3]] as const) {
    add({ id: `cloth_${p}_${t}`, name: `${FIBRES[t]} ${name}`, icon: ic, color: FIBRE_COLORS[t], tier: t, slot, armour: t * ar, power: t, req: { magic: L } });
    recipe(`cloth_${p}_${t}`, 'workbench', 'crafting', lv(n - 1), X * n, [[`fibre_${t}`, n]]);
  }
  recipe(`${m}_bar`, 'furnace', 'smithing', L, X, [[`${m}_ore`, 2]]);
  recipe(`${m}_pickaxe`, 'anvil', 'smithing', lv(0), X * 2, [[`${m}_bar`, 2], [`${w}_log`, 1]]);
  recipe(`${m}_axe`, 'anvil', 'smithing', lv(0), X * 2, [[`${m}_bar`, 2], [`${w}_log`, 1]]);
  recipe(`${m}_sword`, 'anvil', 'smithing', lv(1), X * 2, [[`${m}_bar`, 3], [`${w}_log`, 1]]);
  recipe(`${m}_arrowhead`, 'anvil', 'smithing', lv(1), X, [[`${m}_bar`, 1]], 15);
  recipe(`${m}_helm`, 'anvil', 'smithing', lv(2), X * 3, [[`${m}_bar`, 3]]);
  recipe(`${m}_greaves`, 'anvil', 'smithing', lv(3), X * 4, [[`${m}_bar`, 4]]);
  recipe(`${m}_plate`, 'anvil', 'smithing', lv(4), X * 5, [[`${m}_bar`, 5]]);
  recipe(`${w}_shaft`, 'workbench', 'crafting', lv(0), X * 0.6, [[`${w}_log`, 1]], 15);
  recipe(`${m}_arrow`, 'workbench', 'crafting', lv(0), X * 0.6, [[`${m}_arrowhead`, 15], [`${w}_shaft`, 15]], 15);
  recipe(`${w}_bow`, 'workbench', 'crafting', lv(1), X * 2, [[`${w}_log`, 3], [`fibre_${t}`, 1]]);
  recipe(`${w}_staff`, 'workbench', 'crafting', lv(1), X * 2, [[`${w}_log`, 3], ['essence', 10]]);
  recipe(`amulet_${t}`, 'workbench', 'crafting', lv(4), X * 3, [[`gem_${t}`, 1], [`fibre_${t}`, 1]]);
}
// Uniques
add({ id: 'barnacle_charm', name: 'Barnacle charm', icon: 'amulet', color: '#7fb5a8', tier: 1, slot: 'neck', acc: 6, power: 3, armour: 4, unique: true });
add({ id: 'rootcleaver', name: 'Rootcleaver', icon: 'sword', color: '#9fc36a', tier: 5, slot: 'weapon', style: 'melee', acc: 48, power: 50, speed: 4, range: 1, req: { melee: 40 }, unique: true });
add({ id: 'briarstring', name: 'Briarstring', icon: 'bow', color: '#9fc36a', tier: 5, slot: 'weapon', style: 'ranged', acc: 48, power: 34, speed: 4, range: 7, req: { ranged: 40 }, unique: true });
add({ id: 'heartwood', name: 'Heartwood staff', icon: 'staff', color: '#9fc36a', tier: 5, slot: 'weapon', style: 'magic', acc: 52, power: 56, speed: 5, range: 7, req: { magic: 40 }, unique: true });

// Resource nodes
export interface NodeDef { id: string; name: string; kind: 'rock' | 'tree' | 'plant'; tier: number; skill: Skill | null; level: number; xp: number; item: string; tool?: 'pickaxe' | 'axe'; respawn: number; deplete: number; color: string; }
export const NODES: Record<string, NodeDef> = {};
for (let t = 1; t <= 5; t++) {
  NODES[`rock_${t}`] = { id: `rock_${t}`, name: `${cap(METALS[t])} rock`, kind: 'rock', tier: t, skill: 'mining', level: TIER_LEVEL[t], xp: TIER_XP[t], item: `${METALS[t]}_ore`, tool: 'pickaxe', respawn: 4 + t * 4, deplete: 0.5, color: METAL_COLORS[t] };
  NODES[`tree_${t}`] = { id: `tree_${t}`, name: `${cap(WOODS[t])} tree`, kind: 'tree', tier: t, skill: 'woodcutting', level: TIER_LEVEL[t], xp: TIER_XP[t], item: `${WOODS[t]}_log`, tool: 'axe', respawn: 6 + t * 5, deplete: 0.25, color: WOOD_COLORS[t] };
  NODES[`plant_${t}`] = { id: `plant_${t}`, name: FIBRES[t], kind: 'plant', tier: t, skill: 'crafting', level: TIER_LEVEL[t], xp: TIER_XP[t] * 0.4, item: `fibre_${t}`, respawn: 6 + t * 3, deplete: 0.6, color: FIBRE_COLORS[t] };
}
NODES.essence_rock = { id: 'essence_rock', name: 'Essence rock', kind: 'rock', tier: 1, skill: 'mining', level: 1, xp: 15, item: 'essence', tool: 'pickaxe', respawn: 8, deplete: 0.1, color: '#8fb8d8' };
NODES.berry_bush = { id: 'berry_bush', name: 'Berry bush', kind: 'plant', tier: 1, skill: null, level: 1, xp: 0, item: 'berries', respawn: 12, deplete: 0.4, color: '#a8485e' };

// Loot: every guaranteed entry, plus one weighted common, plus independent rare and unique chances.
export interface LootTable { always?: [string, number, number][]; common?: [string, number, number][]; rare?: [string, number, number][]; unique?: [string, number][]; }
export interface MonsterDef { id: string; name: string; style: Style; level: number; hp: number; acc: number; power: number; armour: number; speed: number; range: number; aggro: number; respawn: number; size: number; color: string; shape: 'beast' | 'wisp' | 'plant' | 'golem' | 'crab' | 'treant'; loot: LootTable; boss?: BossDef; }
export interface BossAttack { id: 'melee' | 'boulder' | 'vines' | 'quake'; name: string; weight: number; windup: number; execute: number; damage: [number, number]; root?: number; count?: number; }
export interface BossDef { baseHp: number; arena: number; world: boolean; attacks: BossAttack[]; }
export const MONSTERS: Record<string, MonsterDef> = {};
const mon = (d: Omit<MonsterDef, 'acc' | 'power' | 'armour' | 'speed' | 'range' | 'respawn' | 'size'> & Partial<MonsterDef>) => {
  MONSTERS[d.id] = { acc: d.level, power: d.level * 0.9, armour: d.level * 0.6, speed: 5, range: d.style === 'melee' ? 1 : 5, respawn: 15, size: 1, ...d };
};
mon({ id: 'boar', name: 'Meadow boar', style: 'melee', level: 1, hp: 12, aggro: 0, color: '#8d6a4c', shape: 'beast', loot: { always: [['hide_1', 1, 1], ['meat', 1, 1]] } });
mon({ id: 'spitter', name: 'Thorn spitter', style: 'ranged', level: 3, hp: 14, aggro: 0, color: '#6e9a58', shape: 'plant', loot: { always: [['fibre_1', 1, 2]], rare: [['gem_1', 1, 0.1]] } });
mon({ id: 'wisp', name: 'Pale wisp', style: 'magic', level: 5, hp: 18, aggro: 0, color: '#a9c4d8', shape: 'wisp', loot: { always: [['essence', 3, 8]], rare: [['gem_1', 1, 0.15]] } });
mon({ id: 'wolf', name: 'Ridge wolf', style: 'melee', level: 12, hp: 38, aggro: 4, color: '#6f7680', shape: 'beast', loot: { always: [['hide_2', 1, 1], ['meat', 1, 2]], rare: [['gem_2', 1, 0.05]] } });
mon({ id: 'marshwisp', name: 'Marsh wisp', style: 'magic', level: 15, hp: 42, aggro: 0, color: '#8fc7a0', shape: 'wisp', loot: { always: [['essence', 8, 16]], rare: [['gem_2', 1, 0.15]] } });
mon({ id: 'thornback', name: 'Thornback', style: 'ranged', level: 22, hp: 65, aggro: 4, color: '#6e7b4a', shape: 'beast', loot: { always: [['hide_3', 1, 2], ['meat', 1, 2]], rare: [['gem_3', 1, 0.05]] } });
mon({ id: 'golem', name: 'Stone golem', style: 'melee', level: 26, hp: 85, aggro: 0, color: '#85827a', shape: 'golem', loot: { common: [['mithril_ore', 1, 3], ['iron_bar', 1, 2]], rare: [['gem_3', 1, 0.15]] } });
mon({ id: 'drake', name: 'Storm drake', style: 'magic', level: 32, hp: 110, aggro: 5, color: '#5c6f8c', shape: 'beast', loot: { always: [['hide_4', 1, 2]], common: [['essence', 10, 25], ['meat', 1, 3]], rare: [['gem_4', 1, 0.08]] } });
mon({ id: 'stalker', name: 'Cragstalker', style: 'ranged', level: 36, hp: 125, aggro: 5, color: '#a8573a', shape: 'plant', loot: { common: [['cobalt_arrow', 8, 20], ['fibre_4', 1, 3]], rare: [['gem_4', 1, 0.15]] } });
mon({ id: 'stag', name: 'Dread stag', style: 'melee', level: 42, hp: 160, aggro: 5, color: '#6b4456', shape: 'beast', loot: { always: [['hide_5', 1, 2], ['meat', 1, 3]], rare: [['gem_5', 1, 0.06]] } });
mon({ id: 'seer', name: 'Hollow seer', style: 'magic', level: 46, hp: 180, aggro: 5, color: '#8a6cae', shape: 'wisp', loot: { always: [['essence', 15, 30]], rare: [['gem_5', 1, 0.15]] } });
mon({ id: 'gnashclaw', name: 'Old Gnashclaw', style: 'melee', level: 8, hp: 90, aggro: 0, respawn: 60, size: 2, color: '#b5604a', shape: 'crab',
  loot: { always: [['rudder', 1, 1]], common: [['copper_bar', 2, 5], ['essence', 15, 30], ['iron_ore', 2, 4]], rare: [['gem_1', 1, 0.3], ['gem_2', 1, 0.1]], unique: [['barnacle_charm', 1 / 12]] },
  boss: { baseHp: 90, arena: 9, world: false, attacks: [
    { id: 'melee', name: 'Claw', weight: 4, windup: 3, execute: 1, damage: [3, 6] },
    { id: 'boulder', name: 'Hurled stone', weight: 3, windup: 5, execute: 2, damage: [9, 14], count: 1 },
    { id: 'vines', name: 'Grasping kelp', weight: 2, windup: 6, execute: 2, damage: [4, 7], root: 4, count: 1 }] } });
mon({ id: 'colossus', name: 'Orrumax, the Rooted', style: 'melee', level: 45, hp: 900, aggro: 0, respawn: 600, size: 3, color: '#5d6b45', shape: 'treant',
  loot: { always: [['essence', 40, 80], ['feast', 1, 3]], common: [['adamantite_bar', 2, 5], ['ebony_log', 4, 8], ['cobalt_bar', 4, 8], ['hide_5', 2, 5]], rare: [['gem_5', 1, 0.25], ['amulet_5', 1, 0.05]], unique: [['rootcleaver', 1 / 40], ['briarstring', 1 / 40], ['heartwood', 1 / 40]] },
  boss: { baseHp: 900, arena: 12, world: true, attacks: [
    { id: 'melee', name: 'Crushing limb', weight: 3, windup: 2, execute: 1, damage: [14, 24] },
    { id: 'boulder', name: 'Falling boulder', weight: 4, windup: 5, execute: 2, damage: [28, 42], count: 5 },
    { id: 'vines', name: 'Creeping vines', weight: 3, windup: 6, execute: 2, damage: [8, 14], root: 5, count: 5 },
    { id: 'quake', name: 'Root quake', weight: 2, windup: 4, execute: 2, damage: [24, 36] }] } });

export const BOAT_PARTS: { id: string; name: string; item: string; qty: number }[] = [
  { id: 'hull', name: 'Ash hull', item: 'ash_log', qty: 20 },
  { id: 'fittings', name: 'Copper fittings', item: 'copper_bar', qty: 8 },
  { id: 'sail', name: 'Flax sail', item: 'fibre_1', qty: 12 },
  { id: 'rudder', name: 'Rudder', item: 'rudder', qty: 1 },
];
