// What the client works with. The wire format is proto/driftwake/v1/game.proto; client/src/net/wire.ts translates.
import type { Look, Skill, Slot } from './content';
import type { MapId, StationType } from './map';

export type TilePos = [x: number, y: number];
export interface Stack {
  id: string;
  qty: number;
}

/** Something the player asks the server to do. */
export type ClientMsg =
  | { type: 'register' | 'login'; name: string; password: string }
  | { type: 'resume'; token: string }
  | { type: 'logout' | 'grave' | 'depositAll' | 'askFees' }
  /** Without an item: everything. */
  | { type: 'claim'; item?: string }
  | { type: 'shop'; op: 'buy' | 'sell'; item: string; qty: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'gather' | 'station' | 'attack' | 'pickup'; id: string }
  | { type: 'craft'; recipe: string; qty: number }
  | { type: 'equip' | 'eat' | 'drop'; slot: number }
  | { type: 'unequip'; slot: Slot }
  | { type: 'swap'; a: number; b: number }
  | { type: 'bank'; op: 'deposit' | 'withdraw'; item: string; qty: number }
  | { type: 'boat'; op: 'build' | 'sail' }
  | { type: 'look'; look: Look }
  | { type: 'chat'; text: string };

export interface BossView {
  state: 'choose' | 'windup' | 'execute';
  attack?: string;
  tiles: TilePos[];
  /** Ticks at which the current state began and ends. */
  start: number;
  end: number;
  target?: string;
}

export type EntityKind = 'player' | 'monster' | 'node' | 'drop' | 'grave';
/** Anything the server reports at a position. Nodes are only reported while they are depleted or glowing. */
export interface Entity {
  id: string;
  kind: EntityKind;
  x: number;
  y: number;
  /** Tiles walked during the latest tick. */
  via?: TilePos[];
  name?: string;
  /** Monster or item id. */
  type?: string;
  hp?: number;
  maxHp?: number;
  action?: string;
  target?: string;
  /** Weapon, head, body, legs. */
  gear?: (string | null)[];
  look?: Look;
  level?: number;
  rooted?: boolean;
  glowing?: boolean;
  tool?: string;
  qty?: number;
  boss?: BossView;
}

export type GameEvent =
  | { type: 'hit'; from: string; to: string; damage: number; style: string }
  | { type: 'impact'; boss: string; attack: string; tiles: TilePos[] }
  | { type: 'death'; id: string };

/** The player's own character, which only they can see in full. */
export interface SelfState {
  id: string;
  name: string;
  map: MapId;
  xp: Record<Skill, number>;
  inv: (Stack | null)[];
  equip: Partial<Record<Slot, Stack>>;
  bank: Stack[];
  boat: Record<string, number>;
  boatDone: boolean;
  /** Lost by dying. */
  reaper: Stack[];
  /** Uniques that were not picked up in time. */
  kept: Stack[];
  look: Look;
}

export type InfoKind = 'unique' | 'boss' | 'level' | 'bad';
/** Still encoded against what the client already knows; see mergeEntity. */
export interface EntityDelta {
  id: number;
  full: boolean;
}
export type ServerMsg =
  | { type: 'welcome'; token: string; id: string }
  | { type: 'error' | 'kicked'; text: string }
  | { type: 'self'; self: SelfState }
  | {
      type: 'snapshot';
      tick: number;
      map: MapId;
      reset: boolean;
      entities: EntityDelta[];
      gone: string[];
      events: GameEvent[];
    }
  | { type: 'chat'; from: string; text: string }
  | { type: 'info'; text: string; kind?: InfoKind }
  | { type: 'xp'; skill: Skill; amount: number }
  | { type: 'open'; station: StationType | 'grave' }
  /** Coins that graves and the reaper have taken from everyone, ever. */
  | { type: 'fees'; taken: number }
  | { type: 'boss'; alive: boolean; nextTicks: number; contribution: number; online: number };
