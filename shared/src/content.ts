// Game content, loaded from the generated data files. Edit content/src and run `npm run content`.
import data from '../../content/data/content.json';
export const GAME_NAME = 'Driftwake'; // working title; rename here before any public launch
export const SKILLS = [
  'mining',
  'smithing',
  'woodcutting',
  'fishing',
  'crafting',
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
  tool?: 'pickaxe' | 'axe' | 'rod';
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
  kind: 'rock' | 'tree' | 'plant' | 'spot';
  tier: number;
  skill: Skill | null;
  level: number;
  xp: number;
  item: string;
  tool?: 'pickaxe' | 'axe' | 'rod';
  respawn: number;
  deplete: number;
  /** Skill level that counts as a beginner's, which decides how often an attempt succeeds. */
  difficulty: number;
  /** Ticks between attempts. */
  interval: number;
  /** Width in tiles. */
  size: number;
  /** Whether one of a group of these glows at times. */
  glows: boolean;
  /** Instead of running out, it moves to another place of its group. */
  moves?: boolean;
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
  shape: 'beast' | 'bird' | 'wisp' | 'plant' | 'golem' | 'crab' | 'treant';
  loot: LootTable;
  boss?: BossDef;
  /** Another monster whose model it shares. */
  looksLike?: string;
}
/** What is needed for each step is up to the server. */
export interface Quest {
  id: string;
  name: string;
  offer: string;
  steps: { text: string }[];
  reward: [string, number][];
}
export interface BossAttack {
  id: 'melee' | 'boulder' | 'vines' | 'quake' | 'snap' | 'double_snap' | 'jet';
  /** How it marks ground; melee has none. */
  shape?: string;
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
/** Methods beyond the basic one. */
export interface Methods {
  /** Skill level from which they work. */
  level: number;
}
/** Percentages are of an item's shop value. */
export interface Economy {
  shopStock: string[];
  sellPercent: number;
  graveFeePercent: number;
  reaperFeePercent: number;
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
  economy: Economy;
  methods: Methods;
  quests: Quest[];
};
export const ITEMS = byId(d.items),
  RECIPES = d.recipes,
  NODES = byId(d.nodes),
  MONSTERS = byId(d.monsters),
  BOAT_PARTS = d.boatParts,
  METALS = d.metals,
  HAIRCUTS = d.haircuts,
  HAIR_COLORS = d.hairColors,
  ECONOMY = d.economy,
  METHODS = d.methods,
  QUESTS = d.quests;
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
