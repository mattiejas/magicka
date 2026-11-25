// Authoring source for the maps. Run `npm run content` after editing.
import { NODES } from './items';
export type MapId = 'island' | 'mainland' | 'mine';
export const T = { WATER: 0, SAND: 1, GRASS: 2, DIRT: 3, STONE: 4, WOOD: 5, PATH: 6 } as const;
/** The tallest height there is, and the steepest step between two neighbouring tiles that can be walked. */
export const MAX_HEIGHT = 35;
export const MAX_STEP = 3;
/** Things stand where the ground is nearly level: its heights around differ by no more than this. */
const LEVEL = 1;
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
  /** Ground height of each tile in `HEIGHT_UNIT`s (shared/src/map.ts), from 0 to 35. Only drawn. */
  heights: Uint8Array;
  /** Tiles that are too steep, or otherwise cannot be walked on, apart from water and what stands on them. */
  walls: Uint8Array;
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
  /** Tiles that can be walked to from the spawn; known after `settle`. */
  reach: Uint8Array | null = null;
  /**
   * With `own`, each scatter and each mob group draws from a stream of its own, started by one number of the
   * shared one, so that a group which finds the ground in its way does not move all the groups after it.
   */
  constructor(
    id: MapId,
    name: string,
    size: number,
    seed: number,
    rx: number,
    ry: number,
    private own = false,
  ) {
    this.rnd = mulberry(seed);
    const c = size / 2,
      a = this.rnd() * 6,
      b = this.rnd() * 6;
    this.m = {
      id,
      name,
      size,
      tiles: new Uint8Array(size * size),
      heights: new Uint8Array(size * size),
      walls: new Uint8Array(size * size),
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
  road(x: number, y: number, x2: number, y2: number, paving: number = T.DIRT) {
    const wearable: number[] = paving === T.PATH ? [T.GRASS, T.SAND, T.DIRT] : [T.GRASS, T.SAND];
    const put = () => {
      for (const [i, j] of [
        [0, 0],
        [1, 0],
        [0, 1],
      ]) {
        const k = (y + j) * this.m.size + x + i;
        if (wearable.includes(this.m.tiles[k])) this.m.tiles[k] = paving;
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
    if (!this.level(x, y, 1)) throw new Error(`${type} does not stand level at ${x},${y}`);
    this.m.stations.push({ id: `${this.m.id}:${type}`, type, x, y });
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) this.used.add((y + j) * this.m.size + x + i);
  }
  /** The random numbers of one group of things: the shared sequence, or a stream of its own. */
  private stream(): () => number {
    return this.own ? mulberry(Math.floor(this.rnd() * 4294967296)) : this.rnd;
  }
  scatter(type: string, n: number, cx: number, cy: number, r: number) {
    const rnd = this.stream();
    for (let k = 0, tries = 0; k < n && tries < 600; tries++) {
      const a = rnd() * 6.283,
        d = Math.sqrt(rnd()) * r,
        x = Math.round(cx + Math.cos(a) * d),
        y = Math.round(cy + Math.sin(a) * d),
        i = y * this.m.size + x;
      const t = this.m.tiles[i];
      if (!t || t === T.WOOD || t === T.DIRT || t === T.PATH || this.used.has(i)) continue;
      if (!this.standable(x, y, 1)) continue;
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
    const rnd = this.stream();
    for (let k = 0, g = 0; k < n && g < 500; g++) {
      const x = Math.round(cx + (rnd() * 2 - 1) * r),
        y = Math.round(cy + (rnd() * 2 - 1) * r),
        i = y * this.m.size + x;
      if (!this.m.tiles[i] || this.used.has(i) || !this.standable(x, y, 1)) continue;
      if (this.own) this.used.add(i); // monsters of one group do not share a tile
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
    if (!this.level(x, y, size)) throw new Error(`${type} does not stand level at ${x},${y}`);
    this.m.nodes.push({ id: `${this.m.id}:n${this.m.nodes.length}`, type, x, y });
  }
  keep(x: number, y: number, r: number) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) this.used.add((y + j) * this.m.size + x + i);
  }
  private land(i: number) {
    return this.m.tiles[i] !== T.WATER;
  }
  private height(x: number, y: number) {
    return this.m.heights[y * this.m.size + x];
  }
  /** Whether the ground under a square of tiles, and the tiles around it, is nearly level. */
  level(x: number, y: number, size: number) {
    const { size: side, heights } = this.m;
    let low = MAX_HEIGHT,
      high = 0;
    for (let j = y - 1; j <= y + size; j++)
      for (let i = x - 1; i <= x + size; i++) {
        if (i < 0 || j < 0 || i >= side || j >= side || !this.land(j * side + i)) continue;
        low = Math.min(low, heights[j * side + i]);
        high = Math.max(high, heights[j * side + i]);
      }
    return high - low <= LEVEL;
  }
  /** Whether a tile is level ground that can be walked to from the spawn. */
  private standable(x: number, y: number, size: number) {
    return this.level(x, y, size) && (!this.reach || !!this.reach[y * this.m.size + x]);
  }
  /** Raises the ground to at least `to(x, y)` units, where that is above 0, on all land. */
  raise(to: (x: number, y: number) => number) {
    const { size, heights } = this.m;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (this.land(i) && this.m.tiles[i] !== T.WOOD)
          heights[i] = Math.min(MAX_HEIGHT, Math.max(heights[i], Math.round(to(x, y))));
      }
  }
  /** Changes the type of every tile for which `to` returns one. */
  paint(to: (x: number, y: number, current: number) => number | undefined) {
    const { size, tiles } = this.m;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const type = tiles[i] === T.WATER || tiles[i] === T.WOOD ? undefined : to(x, y, tiles[i]);
        if (type !== undefined) tiles[i] = type;
      }
  }
  /** How many tiles a land tile is from the nearest water, up to `limit`. */
  shoreDistance(x: number, y: number, limit: number) {
    const { size, tiles } = this.m;
    let nearest = limit;
    for (let j = y - limit; j <= y + limit; j++)
      for (let i = x - limit; i <= x + limit; i++)
        if (i >= 0 && j >= 0 && i < size && j < size && tiles[j * size + i] === T.WATER)
          nearest = Math.min(nearest, Math.max(Math.abs(i - x), Math.abs(j - y)));
    return nearest;
  }
  /** Walls the tiles that are too steep to walk on, and works out which tiles can be walked to. */
  settle() {
    const { size, heights, walls, tiles } = this.m;
    const flat = (i: number) => tiles[i] === T.WATER || tiles[i] === T.WOOD;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (flat(i)) continue;
        for (let j = Math.max(0, y - 1); j <= Math.min(size - 1, y + 1); j++)
          for (let k = Math.max(0, x - 1); k <= Math.min(size - 1, x + 1); k++) {
            const o = j * size + k;
            // a diagonal step is longer, and may be a little steeper
            const allowed = j === y || k === x ? MAX_STEP : MAX_STEP * 1.5;
            if (!flat(o) && Math.abs(heights[i] - heights[o]) > allowed) walls[i] = 1;
          }
      }
    const open = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < size && y < size && tiles[y * size + x] !== T.WATER && !walls[y * size + x];
    const reach = new Uint8Array(size * size);
    const { x: sx, y: sy } = this.m.spawn;
    const queue = [[sx, sy]];
    reach[sy * size + sx] = 1;
    for (const [x, y] of queue)
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
        [1, -1],
        [1, 1],
        [-1, 1],
        [-1, -1],
      ]) {
        const [nx, ny] = [x + dx, y + dy];
        // diagonal steps do not cut corners, as in the server's paths
        if (!open(nx, ny) || reach[ny * size + nx] || (dx && dy && !(open(nx, y) && open(x, ny)))) continue;
        reach[ny * size + nx] = 1;
        queue.push([nx, ny]);
      }
    this.reach = reach;
  }
  done() {
    const m = this.m;
    this.settle();
    for (let i = 0; i < m.tiles.length; i++) if (m.tiles[i] === T.WATER || m.walls[i]) m.blocked[i] = 1;
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
const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};
/** The angle from one direction to another, in degrees, whichever way is shorter. */
const turn = (from: number, to: number) => Math.abs(((from - to + 540) % 360) - 180);

/** The crater of the copper mine: a floor, a steep wall, a rim, and gaps in the rim that can be walked. */
const CRATER = { x: 45, y: 20, floor: 5.3, wall: 2, rim: 12, saddle: 3, crest: 1 };
/** Where the rim is low: towards camp, and to the north west, towards the essence rocks. */
const GATES = [
  { angle: 135, width: 5 },
  { angle: 205, width: 4 },
];
function crater(x: number, y: number): number {
  const { x: cx, y: cy, floor, wall, rim, saddle, crest } = CRATER;
  const d = Math.hypot(x - cx, y - cy);
  if (d <= floor) return 0;
  const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
  // gates are measured in tiles along the rim, so that they are as wide as they say
  const along = (gate: { angle: number }) => (turn(angle, gate.angle) * Math.PI * (floor + wall)) / 180;
  const height = GATES.reduce(
    (high, gate) => Math.min(high, saddle + (rim - saddle) * smooth((along(gate) - gate.width / 2) / 1.2)),
    rim + Math.round(1.5 * Math.sin((angle * Math.PI) / 36)),
  );
  if (d <= floor + wall) return height * smooth((d - floor) / wall);
  if (d <= floor + wall + crest) return height;
  // behind a high rim the ground falls away in a cliff; behind a low one it can be walked down
  const fall = height > MAX_STEP * 2 ? 1.5 : height / 2;
  return height * (1 - smooth((d - floor - wall - crest) / fall));
}

/** A mound that can be walked up, with a flat top. */
const mound =
  (cx: number, cy: number, flat: number, slope: number, height: number) => (x: number, y: number) =>
    height * (1 - smooth((Math.hypot(x - cx, y - cy) - flat) / slope));

function island() {
  const b = new Builder('island', 'Driftwake Isle', 64, 7, 27, 25, true),
    m = b.m;
  b.disc(32, 34, 5, T.DIRT);
  b.disc(32, 34, 3, T.PATH);
  b.road(32, 34, 32, 58, T.PATH);
  b.road(32, 34, 42, 24, T.PATH);
  b.road(32, 34, 18, 28, T.PATH);
  b.road(32, 34, 44, 42);
  b.rect(31, 53, 3, 8, T.WOOD);
  m.spawn = { x: 32, y: 35 };
  m.landing = { x: 32, y: 55 };
  m.safe = { x: 32, y: 34, r: 6 };
  // Ground: a hill in the north, a rise under the ash grove, the crater of the mine and cliffs along the shore.
  b.raise(mound(23, 15, 1, 7, 12));
  b.raise(mound(14, 26, 6, 4, 5));
  b.raise(crater);
  b.raise((x, y) => {
    const angle = (Math.atan2(y - 32, x - 32) * 180) / Math.PI;
    const ends = smooth((turn(angle, -90) < 62 ? 62 - turn(angle, -90) : 0) / 14);
    const shore = b.shoreDistance(x, y, 4);
    return shore < 4 ? ends * Math.max(0, 9 + Math.round(2 * Math.sin(angle / 7)) - 3 * (shore - 1)) : 0;
  });
  b.paint((x, y, tile) => {
    const high = m.heights[y * m.size + x];
    if (tile === T.PATH || tile === T.DIRT) return undefined;
    if (b.shoreDistance(x, y, 2) === 1 && high > MAX_STEP) return T.STONE;
    return high >= 10 ? T.STONE : tile === T.SAND && high > 0 ? T.GRASS : undefined;
  });
  b.disc(CRATER.x, CRATER.y, 5, T.STONE);
  b.disc(51, 40, 5, T.SAND);
  b.settle();
  b.station('bank', 29, 32);
  b.station('furnace', 33, 30);
  b.station('anvil', 36, 31);
  b.station('workbench', 28, 36);
  b.station('reaper', 36, 37);
  b.station('dock', 33, 57);
  b.station('shop', 29, 39);
  b.keep(32, 34, 6);
  b.keep(51, 40, 6);
  b.scatter('rock_1', 7, CRATER.x, CRATER.y, 4);
  b.scatter('rock_2', 2, CRATER.x, CRATER.y, 4);
  b.keep(CRATER.x, CRATER.y, 6); // nothing roams on the floor of the mine
  b.scatter('essence_rock', 3, 36, 17, 4);
  b.scatter('tree_1', 16, 17, 26, 8);
  b.scatter('tree_2', 2, 13, 22, 4);
  b.scatter('plant_1', 7, 26, 46, 6);
  b.scatter('berry_bush', 5, 22, 40, 6);
  b.mobs('boar', 6, 22, 44, 6);
  b.mobs('spitter', 4, 33, 18, 5);
  b.mobs('wisp', 4, 39, 15, 4);
  m.spawns.push({ type: 'gnashclaw', x: 50, y: 39 });
  b.mobs('chicken', 5, 39, 43, 3);
  m.labels.push(
    { name: 'Camp', x: 32, y: 34 },
    { name: 'Copper crater', x: CRATER.x, y: CRATER.y + 1 },
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
