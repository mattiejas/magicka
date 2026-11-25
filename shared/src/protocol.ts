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
  | { type: 'changePassword'; oldPassword: string; newPassword: string }
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
  | { type: 'trade' | 'npc' | 'startQuest'; id: string }
  | { type: 'sellToTrader'; qty: number }
  | { type: 'useLamp'; skill: Skill }
  | { type: 'tradeStep'; action: 'accept' | 'decline' }
  | { type: 'tradeStep'; action: 'offer' | 'takeBack'; item: string; qty: number }
  | { type: 'block'; name: string; on: boolean }
  | { type: 'report'; name: string; reason: ReportReason }
  | { type: 'boat'; op: 'build' | 'sail' }
  | { type: 'look'; look: Look }
  | { type: 'chat'; text: string };

export const REPORT_REASONS = ['language', 'scam', 'cheating', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export interface TradeView {
  partner: string;
  mine: Stack[];
  theirs: Stack[];
  iAccepted: boolean;
  theyAccepted: boolean;
  /** Tick from which the offers can be accepted. */
  readyAt: number;
}

export interface BossView {
  state: 'choose' | 'windup' | 'execute';
  attack?: string;
  tiles: TilePos[];
  /** Where the attack is aimed, which a clipped square of tiles does not show. */
  centres: TilePos[];
  /** Ticks at which the current state began and ends. */
  start: number;
  end: number;
  target?: string;
}

export type EntityKind = 'player' | 'monster' | 'node' | 'drop' | 'grave' | 'npc';
/** Anything the server reports at a position. Nodes are only reported while they are depleted, glowing or rich. */
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
  /** Weapon, head, body, legs, cape. */
  gear?: (string | null)[];
  look?: Look;
  level?: number;
  rooted?: boolean;
  glowing?: boolean;
  /** A rock with a rich vein. */
  rich?: boolean;
  /** What a stranded trader buys. */
  wants?: string;
  /** Tick at which a drop disappears. */
  until?: number;
  /** Tick at which a drop becomes public; zero means never. */
  publicAt?: number;
  tool?: string;
  qty?: number;
  boss?: BossView;
}

export type GameEvent =
  | { type: 'hit'; from: string; to: string; damage: number; style: string }
  | { type: 'impact'; boss: string; attack: string; tiles: TilePos[]; centres: TilePos[] }
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
  /** Names, in lower case, of players not to hear from. */
  blocked: string[];
  /** Steps done of every quest begun. */
  quests: Record<string, number>;
  /** How often each thing in the collection log was found, by "source/item". */
  found: Record<string, number>;
  /** How many times loot was earned from each boss, by boss id. */
  kills: Record<string, number>;
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
  | { type: 'chat'; from: string; text: string /** Entity of the speaker. */; id: string }
  | { type: 'info'; text: string; kind?: InfoKind }
  | { type: 'xp'; skill: Skill; amount: number }
  | { type: 'open'; station: StationType | 'grave' | 'trader' }
  /** Coins that graves and the reaper have taken from everyone, ever. */
  | { type: 'fees'; taken: number }
  | { type: 'tradeRequest'; id: string; name: string }
  /** Null when the trade has ended. */
  | { type: 'trade'; trade: TradeView | null }
  | {
      type: 'boss';
      alive: boolean;
      nextTicks: number;
      contribution: number;
      online: number;
      /** Name of the world boss that is up, or that rises next. */
      next: string;
    };
