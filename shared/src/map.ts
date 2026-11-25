// Maps, loaded from the generated data file. Edit content/src/maps.ts and run `npm run content`.
import data from '../../content/data/maps.json';
import { NODES } from './content';
export type MapId = 'island' | 'mainland' | 'mine';
export const T = { WATER: 0, SAND: 1, GRASS: 2, DIRT: 3, STONE: 4, WOOD: 5 } as const;
export type StationType = 'bank' | 'furnace' | 'anvil' | 'workbench' | 'reaper' | 'dock' | 'shop' | 'mine';
export interface MapNode {
  id: string;
  type: string;
  x: number;
  y: number;
}
export interface MapStation {
  id: string;
  type: StationType;
  x: number;
  y: number;
}
export interface Spawn {
  type: string;
  x: number;
  y: number;
}
export interface GameMap {
  id: MapId;
  name: string;
  size: number;
  tiles: Uint8Array;
  /** Ground height of each tile in `HEIGHT_UNIT`s. Only drawn; it changes nothing in play. */
  heights: Uint8Array;
  blocked: Uint8Array;
  nodes: MapNode[];
  stations: MapStation[];
  spawns: Spawn[];
  spawn: { x: number; y: number };
  landing: { x: number; y: number };
  safe: { x: number; y: number; r: number };
  /** Whether methods beyond the basic one are found here. */
  methods: boolean;
  /** Underground: what is not floor is rock instead of water. */
  cave: boolean;
  labels: { name: string; x: number; y: number }[];
}

/** How high one step of a tile's height is, in tiles. */
export const HEIGHT_UNIT = 0.25;

export function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
interface HeightRows {
  heights?: string[];
  walls?: string[];
}
function load(raw: (typeof data)[number]): GameMap {
  const { rows, heights: heightRows, walls: wallRows, ...m } = raw as typeof raw & HeightRows,
    size = m.size,
    tiles = Uint8Array.from(rows.join(''), Number),
    heights = Uint8Array.from(heightRows?.join('') ?? '', digit => Number.parseInt(digit, 36)),
    walls = Uint8Array.from(wallRows?.join('') ?? '', Number),
    blocked = tiles.map((t, i) => (t === T.WATER || walls[i] ? 1 : 0));
  const block = (x: number, y: number, width: number) => {
    for (let j = 0; j < width; j++) for (let i = 0; i < width; i++) blocked[(y + j) * size + x + i] = 1;
  };
  for (const { x, y, type } of m.nodes) block(x, y, NODES[type].size);
  for (const { x, y } of m.stations) block(x, y, 1);
  return {
    ...m,
    tiles,
    heights: heights.length ? heights : new Uint8Array(tiles.length),
    blocked,
  } as unknown as GameMap;
}
export const MAPS = Object.fromEntries(data.map(m => [m.id, load(m)])) as Record<MapId, GameMap>;
