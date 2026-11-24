// Game content, loaded from the generated data files. Edit content/src and run `npm run content`.
import data from '../../content/data/content.json';
export const GAME_NAME = 'Magicka'; // working title; rename here before any public launch
export const SKILLS = [
  'mining',
  'smithing',
  'woodcutting',
  'crafting',
  'melee',
  'ranged',
  'magic',
  'defence',
  'vitality',
] as const;
export type Skill = (typeof SKILLS)[number];
export type Style = 'melee' | 'ranged' | 'magic';
export const SLOTS = ['weapon', 'head', 'body', 'legs', 'neck', 'ammo'] as const;
export type Slot = (typeof SLOTS)[number];
export const INV_SIZE = 24;
export const METAL_COLORS = ['#94887c', '#e07f3c', '#b4bcc8', '#7fb0f0', '#2f62c8', '#2fb58a'];
export const WOOD_COLORS = ['#8a7a60', '#d8b47c', '#b87a48', '#8f5c38', '#b04a38', '#4a3454'];
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
  tool?: 'pickaxe' | 'axe';
  ammo?: 'arrow' | 'essence';
  heal?: number;
  unique?: boolean;
}
export interface Recipe {
  id: string;
  out: string;
  qty: number;
  station: Station;
  skill: Skill;
  level: number;
  xp: number;
  in: [string, number][];
}
export type Station = 'furnace' | 'anvil' | 'workbench';
export interface NodeDef {
  id: string;
  name: string;
  kind: 'rock' | 'tree' | 'plant';
  tier: number;
  skill: Skill | null;
  level: number;
  xp: number;
  item: string;
  tool?: 'pickaxe' | 'axe';
  respawn: number;
  deplete: number;
  color: string;
}
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
  shape: 'beast' | 'wisp' | 'plant' | 'golem' | 'crab' | 'treant';
  loot: LootTable;
  boss?: BossDef;
}
export interface BossAttack {
  id: 'melee' | 'boulder' | 'vines' | 'quake';
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
export interface Look {
  cut: number;
  color: number;
}
const byId = <T extends { id: string }>(l: T[]) =>
  Object.fromEntries(l.map(v => [v.id, v])) as Record<string, T>;
const d = data as unknown as {
  items: Item[];
  recipes: Recipe[];
  nodes: NodeDef[];
  monsters: MonsterDef[];
  boatParts: { id: string; name: string; item: string; qty: number }[];
  metals: string[];
  haircuts: { id: string; name: string }[];
  hairColors: { name: string; color: string }[];
};
export const ITEMS = byId(d.items),
  RECIPES = d.recipes,
  NODES = byId(d.nodes),
  MONSTERS = byId(d.monsters),
  BOAT_PARTS = d.boatParts,
  METALS = d.metals,
  HAIRCUTS = d.haircuts,
  HAIR_COLORS = d.hairColors;
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
