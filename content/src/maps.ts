// Authoring source for the maps. Run `npm run content` after editing.
import { NODES } from './items';
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
  /** Where players wake up after dying here. */
  town: MapId;
  /** Where the mine entrance leads. */
  passage?: { to: MapId; x: number; y: number };
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
class Builder {
  m: GameMap;
  rnd: () => number;
  used = new Set<number>();
  constructor(id: MapId, name: string, size: number, seed: number, rx: number, ry: number) {
    this.rnd = mulberry(seed);
    const c = size / 2,
      a = this.rnd() * 6,
      b = this.rnd() * 6;
    this.m = {
      id,
      name,
      size,
      tiles: new Uint8Array(size * size),
      blocked: new Uint8Array(size * size),
      nodes: [],
      stations: [],
      spawns: [],
      spawn: { x: c, y: c },
      landing: { x: c, y: c },
      safe: { x: c, y: c, r: 0 },
      methods: false,
      cave: false,
      town: id,
      labels: [],
    };
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const dx = (x - c) / rx,
          dy = (y - c) / ry,
          th = Math.atan2(dy, dx);
        const d = Math.hypot(dx, dy) + 0.05 * Math.sin(th * 3 + a) + 0.03 * Math.sin(th * 7 + b);
        this.m.tiles[y * size + x] = d > 1 ? T.WATER : d > 0.9 ? T.SAND : T.GRASS;
      }
  }
  disc(x: number, y: number, r: number, t: number) {
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++)
        if (i * i + j * j <= r * r + 1) this.m.tiles[(y + j) * this.m.size + x + i] = t;
  }
  rect(x: number, y: number, w: number, h: number, t: number) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        this.m.tiles[(y + j) * this.m.size + x + i] = t;
      }
  }
  road(x: number, y: number, x2: number, y2: number) {
    const put = () => {
      for (const [i, j] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ]) {
        const k = (y + j) * this.m.size + x + i;
        if (this.m.tiles[k] === T.GRASS || this.m.tiles[k] === T.SAND) this.m.tiles[k] = T.DIRT;
        this.used.add(k);
      }
    };
    put();
    while (x !== x2 || y !== y2) {
      if (Math.abs(x2 - x) >= Math.abs(y2 - y)) x += Math.sign(x2 - x);
      else y += Math.sign(y2 - y);
      put();
    }
  }
  station(type: StationType, x: number, y: number) {
    this.m.stations.push({ id: `${this.m.id}:${type}`, type, x, y });
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) this.used.add((y + j) * this.m.size + x + i);
  }
  scatter(type: string, n: number, cx: number, cy: number, r: number) {
    for (let k = 0, tries = 0; k < n && tries < 600; tries++) {
      const a = this.rnd() * 6.283,
        d = Math.sqrt(this.rnd()) * r,
        x = Math.round(cx + Math.cos(a) * d),
        y = Math.round(cy + Math.sin(a) * d),
        i = y * this.m.size + x;
      const t = this.m.tiles[i];
      if (!t || t === T.WOOD || t === T.DIRT || this.used.has(i)) continue;
      // keep a walkable gap around every node
      let clear = true;
      for (const o of this.m.nodes) if (Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) < 2) clear = false;
      if (!clear) continue;
      this.used.add(i);
      this.m.nodes.push({ id: `${this.m.id}:n${this.m.nodes.length}`, type, x, y });
      k++;
    }
  }
  mobs(type: string, n: number, cx: number, cy: number, r: number) {
    for (let k = 0, g = 0; k < n && g < 500; g++) {
      const x = Math.round(cx + (this.rnd() * 2 - 1) * r),
        y = Math.round(cy + (this.rnd() * 2 - 1) * r),
        i = y * this.m.size + x;
      if (!this.m.tiles[i] || this.used.has(i)) continue;
      this.m.spawns.push({ type, x, y });
      k++;
    }
  }
  place(type: string, x: number, y: number) {
    const { size } = NODES[type];
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const k = (y + j) * this.m.size + x + i;
        if (!this.m.tiles[k] || this.used.has(k)) throw new Error(`${type} does not fit at ${x},${y}`);
        this.used.add(k);
      }
    this.m.nodes.push({ id: `${this.m.id}:n${this.m.nodes.length}`, type, x, y });
  }
  keep(x: number, y: number, r: number) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) this.used.add((y + j) * this.m.size + x + i);
  }
  done() {
    const m = this.m;
    for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === T.WATER) m.blocked[i] = 1;
    for (const n of m.nodes) {
      if (!NODES[n.type]) throw new Error(n.type);
      const { size } = NODES[n.type];
      for (let j = 0; j < size; j++)
        for (let i = 0; i < size; i++) m.blocked[(n.y + j) * m.size + n.x + i] = 1;
    }
    for (const s of m.stations) m.blocked[s.y * m.size + s.x] = 1;
    return m;
  }
}
function island() {
  const b = new Builder('island', 'Driftwake Isle', 64, 7, 27, 25),
    m = b.m;
  b.disc(32, 34, 5, T.DIRT);
  b.road(32, 34, 32, 58);
  b.road(32, 34, 47, 26);
  b.road(32, 34, 18, 28);
  b.road(32, 34, 44, 42);
  b.rect(31, 53, 3, 8, T.WOOD);
  m.spawn = { x: 32, y: 35 };
  m.landing = { x: 32, y: 55 };
  m.safe = { x: 32, y: 34, r: 6 };
  b.station('bank', 29, 32);
  b.station('furnace', 33, 30);
  b.station('anvil', 36, 31);
  b.station('workbench', 28, 36);
  b.station('reaper', 36, 37);
  b.station('dock', 33, 57);
  b.station('shop', 29, 39);
  b.keep(32, 34, 6);
  b.keep(51, 40, 6);
  b.disc(51, 40, 5, T.SAND);
  b.disc(46, 24, 4, T.STONE);
  b.scatter('rock_1', 7, 46, 24, 5);
  b.scatter('rock_2', 2, 49, 21, 4);
  b.scatter('essence_rock', 3, 42, 19, 4);
  b.scatter('tree_1', 16, 17, 26, 8);
  b.scatter('tree_2', 2, 13, 22, 4);
  b.scatter('plant_1', 7, 26, 46, 6);
  b.scatter('berry_bush', 5, 22, 40, 6);
  b.mobs('boar', 6, 22, 44, 6);
  b.mobs('spitter', 4, 33, 18, 5);
  b.mobs('wisp', 4, 40, 14, 4);
  m.spawns.push({ type: 'gnashclaw', x: 51, y: 40 });
  b.mobs('chicken', 5, 39, 43, 3);
  m.labels.push(
    { name: 'Camp', x: 32, y: 34 },
    { name: 'Copper rise', x: 46, y: 24 },
    { name: 'Ash grove', x: 17, y: 26 },
    { name: 'Dock', x: 32, y: 57 },
    { name: 'Gnashclaw', x: 51, y: 40 },
  );
  return b.done();
}
function mainland() {
  const b = new Builder('mainland', 'Aldermere', 96, 21, 43, 43),
    m = b.m;
  b.disc(48, 76, 6, T.DIRT);
  b.road(48, 76, 48, 90);
  b.rect(47, 84, 3, 9, T.WOOD);
  b.road(48, 76, 48, 22);
  b.road(48, 60, 20, 56);
  b.road(48, 60, 76, 56);
  b.road(48, 40, 22, 34);
  b.road(48, 40, 74, 34);
  m.spawn = { x: 48, y: 77 };
  m.landing = { x: 48, y: 86 };
  m.methods = true;
  m.safe = { x: 48, y: 76, r: 7 };
  b.station('bank', 44, 74);
  b.station('furnace', 49, 71);
  b.station('anvil', 52, 73);
  b.station('workbench', 44, 79);
  b.station('reaper', 53, 79);
  b.station('dock', 49, 89);
  b.station('shop', 52, 82);
  b.keep(48, 76, 7);
  b.keep(48, 20, 9);
  b.disc(48, 20, 8, T.STONE);
  b.scatter('rock_1', 6, 62, 72, 5);
  b.scatter('tree_1', 10, 33, 72, 6);
  b.scatter('plant_1', 5, 38, 66, 4);
  b.scatter('berry_bush', 6, 58, 66, 5);
  b.scatter('essence_rock', 4, 66, 64, 4);
  b.disc(76, 56, 4, T.STONE);
  b.scatter('rock_2', 8, 76, 56, 6);
  b.scatter('tree_2', 12, 20, 58, 7);
  b.scatter('plant_2', 7, 30, 54, 5);
  b.mobs('wolf', 6, 34, 52, 6);
  b.mobs('marshwisp', 5, 64, 52, 5);
  b.disc(78, 42, 4, T.STONE);
  b.scatter('rock_3', 7, 78, 42, 5);
  b.scatter('tree_3', 10, 16, 44, 6);
  b.scatter('plant_3', 6, 28, 44, 5);
  b.mobs('thornback', 5, 26, 42, 5);
  b.mobs('golem', 5, 68, 44, 5);
  b.disc(74, 30, 4, T.STONE);
  b.scatter('rock_4', 6, 74, 30, 5);
  b.scatter('tree_4', 8, 22, 32, 5);
  b.scatter('plant_4', 5, 32, 34, 4);
  b.mobs('drake', 4, 34, 32, 4);
  b.mobs('stalker', 4, 64, 32, 4);
  b.disc(66, 18, 4, T.STONE);
  b.scatter('rock_5', 5, 66, 18, 4);
  b.scatter('tree_5', 6, 30, 20, 5);
  b.scatter('plant_5', 5, 36, 24, 3);
  b.mobs('stag', 4, 32, 22, 4);
  b.mobs('seer', 4, 62, 24, 4);
  m.spawns.push({ type: 'colossus', x: 47, y: 19 });
  b.station('mine', 81, 46);
  m.passage = { to: 'mine', x: 24, y: 42 };
  // Relaxed methods, out of reach of anything that attacks.
  b.place('big_rock_1', 67, 70);
  b.place('big_rock_2', 79, 60);
  b.place('big_rock_3', 84, 48);
  b.place('big_rock_4', 82, 31);
  b.place('big_rock_5', 76, 17);
  b.place('big_essence_rock', 69, 64);
  for (const [x, y] of [
    [15, 27],
    [17, 29],
    [15, 31],
  ])
    b.place('tree_4', x, y);
  for (const [x, y] of [
    [18, 25],
    [20, 23],
    [18, 22],
  ])
    b.place('tree_5', x, y);
  // Danger beside the glowing rocks.
  for (const [type, x, y] of [
    ['golem', 79, 40],
    ['golem', 76, 42],
    ['drake', 71, 29],
    ['drake', 72, 33],
    ['seer', 63, 16],
    ['seer', 63, 20],
  ] as const)
    m.spawns.push({ type, x, y });
  m.labels.push(
    { name: 'Landing', x: 48, y: 76 },
    { name: 'Iron shelf', x: 76, y: 56 },
    { name: 'Mithril shelf', x: 78, y: 42 },
    { name: 'Old mine', x: 81, y: 46 },
    { name: 'Cobalt ridge', x: 74, y: 30 },
    { name: 'Ebony stand', x: 30, y: 20 },
    { name: 'Rooted arena', x: 48, y: 20 },
  );
  return b.done();
}
function mine() {
  const NOTHING = 0.001;
  const b = new Builder('mine', 'Old mine', 48, 5, NOTHING, NOTHING),
    m = b.m;
  m.cave = true;
  m.town = 'mainland';
  m.passage = { to: 'mainland', x: 81, y: 47 };
  b.disc(24, 41, 4, T.DIRT);
  b.disc(11, 29, 6, T.STONE);
  b.disc(37, 27, 6, T.STONE);
  b.disc(24, 10, 8, T.STONE);
  b.rect(23, 14, 3, 26, T.DIRT);
  b.rect(12, 29, 12, 3, T.DIRT);
  b.rect(25, 26, 11, 3, T.DIRT);
  m.spawn = { x: 24, y: 42 };
  m.landing = { x: 24, y: 42 };
  b.station('mine', 24, 44);
  b.keep(24, 10, 4);
  b.scatter('rock_3', 7, 11, 29, 6);
  b.scatter('rock_4', 6, 37, 27, 6);
  b.mobs('golem', 4, 12, 30, 4);
  b.mobs('golem', 2, 24, 25, 2);
  b.mobs('stalker', 3, 37, 27, 4);
  m.spawns.push({ type: 'deepstone', x: 23, y: 9 });
  m.labels.push(
    { name: 'Way out', x: 24, y: 44 },
    { name: 'Mithril seam', x: 11, y: 29 },
    { name: 'Cobalt seam', x: 37, y: 27 },
    { name: 'Deepstone', x: 24, y: 10 },
  );
  return b.done();
}
export const MAPS: Record<MapId, GameMap> = { island: island(), mainland: mainland(), mine: mine() };
