// Maps, loaded from the generated data file. Edit content/src/maps.ts and run `npm run content`.
import data from '../../content/data/maps.json';
export type MapId = 'island' | 'mainland';
export const T = { WATER: 0, SAND: 1, GRASS: 2, DIRT: 3, STONE: 4, WOOD: 5 } as const;
export type StationType = 'bank' | 'furnace' | 'anvil' | 'workbench' | 'reaper' | 'dock';
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
  blocked: Uint8Array;
  nodes: MapNode[];
  stations: MapStation[];
  spawns: Spawn[];
  spawn: { x: number; y: number };
  landing: { x: number; y: number };
  safe: { x: number; y: number; r: number };
  labels: { name: string; x: number; y: number }[];
}

export function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function load(raw: (typeof data)[number]): GameMap {
  const { rows, ...m } = raw,
    size = m.size,
    tiles = Uint8Array.from(rows.join(''), Number),
    blocked = tiles.map(t => (t === T.WATER ? 1 : 0));
  for (const o of [...m.nodes, ...m.stations]) blocked[o.y * size + o.x] = 1;
  return { ...m, tiles, blocked } as unknown as GameMap;
}
export const MAPS = Object.fromEntries(data.map(m => [m.id, load(m)])) as Record<MapId, GameMap>;
