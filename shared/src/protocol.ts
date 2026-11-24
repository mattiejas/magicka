// What the client works with. The wire format is proto/driftwake/v1/game.proto; client/src/wire.ts translates.
import type { Look, Skill, Slot } from './content';
import type { MapId, StationType } from './map';
export type ClientMsg =
  | { t: 'register' | 'login'; name: string; pw: string } | { t: 'resume'; token: string } | { t: 'logout' | 'grave' | 'claim' | 'depositAll' }
  | { t: 'move'; x: number; y: number } | { t: 'gather' | 'station' | 'attack' | 'pickup'; id: string }
  | { t: 'craft'; id: string; qty: number } | { t: 'equip' | 'eat' | 'drop'; slot: number } | { t: 'unequip'; slot: Slot } | { t: 'swap'; a: number; b: number }
  | { t: 'bank'; op: 'deposit' | 'withdraw'; item: string; qty: number } | { t: 'boat'; op: 'build' | 'sail' } | { t: 'look'; cut: number; color: number } | { t: 'chat'; text: string };
export interface Stack { id: string; qty: number }
export interface BossView { st: 'choose' | 'windup' | 'execute'; atk?: string; tiles?: [number, number][]; start: number; end: number; tgt?: string }
export interface Ent {
  id: string; k: 'p' | 'm' | 'n' | 'd' | 'g'; x: number; y: number;
  via?: [number, number][]; name?: string; type?: string; hp?: number; mhp?: number; act?: string; tgt?: string; gear?: (string | null)[]; look?: Look; lvl?: number; rooted?: boolean; tool?: string;
  qty?: number; boss?: BossView;
}
export type GameEvent =
  | { e: 'hit'; from: string; to: string; dmg: number; style: string } | { e: 'impact'; boss: string; atk: string; tiles: [number, number][] }
  | { e: 'death'; id: string };
export interface SelfState {
  id: string; name: string; map: MapId; xp: Record<Skill, number>; inv: (Stack | null)[]; equip: Partial<Record<Slot, Stack>>; bank: Stack[];
  boat: Record<string, number>; boatDone: boolean; reaper: Stack[]; look: Look;
}
/** Still encoded against what the client already knows; see mergeEntity. */
export type EntityDelta = { id: number; full: boolean };
export type ServerMsg =
  | { t: 'welcome'; token: string; id: string } | { t: 'error'; msg: string } | { t: 'kicked'; msg: string }
  | { t: 'self'; s: SelfState } | { t: 'snap'; tick: number; map: MapId; reset?: boolean; raw: EntityDelta[]; gone: string[]; ev: GameEvent[] }
  | { t: 'chat'; from: string; text: string } | { t: 'info'; text: string; kind?: 'unique' | 'boss' | 'level' | 'bad' }
  | { t: 'xp'; skill: Skill; amount: number } | { t: 'open'; station: StationType }
  | { t: 'boss'; alive: boolean; next: number; contrib: number; online: number };
