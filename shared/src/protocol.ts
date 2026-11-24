import { z } from 'zod';
import { HAIRCUTS, HAIR_COLORS, SLOTS, type Look, type Skill, type Slot } from './content';
import type { MapId, StationType } from './map';
const id = z.string().min(1).max(48), n = z.number().int().min(0).max(255), slot = z.number().int().min(0).max(23);
const qty = z.number().int().min(1).max(1_000_000);
const name = z.string().regex(/^[A-Za-z0-9_]{3,16}$/), pw = z.string().min(8).max(128);
export const ClientMsg = z.discriminatedUnion('t', [
  z.object({ t: z.literal('register'), name, pw }), z.object({ t: z.literal('login'), name, pw }),
  z.object({ t: z.literal('resume'), token: z.string().length(64) }), z.object({ t: z.literal('logout') }),
  z.object({ t: z.literal('move'), x: n, y: n }), z.object({ t: z.literal('gather'), id }), z.object({ t: z.literal('station'), id }),
  z.object({ t: z.literal('attack'), id }), z.object({ t: z.literal('pickup'), id }), z.object({ t: z.literal('grave') }),
  z.object({ t: z.literal('claim') }),
  z.object({ t: z.literal('craft'), id, qty: z.number().int().min(1).max(999) }),
  z.object({ t: z.literal('equip'), slot }), z.object({ t: z.literal('unequip'), slot: z.enum(SLOTS) }),
  z.object({ t: z.literal('eat'), slot }), z.object({ t: z.literal('drop'), slot }), z.object({ t: z.literal('swap'), a: slot, b: slot }),
  z.object({ t: z.literal('bank'), op: z.enum(['deposit', 'withdraw']), item: id, qty }), z.object({ t: z.literal('depositAll') }),
  z.object({ t: z.literal('boat'), op: z.enum(['build', 'sail']) }),
  z.object({ t: z.literal('look'), cut: z.number().int().min(0).max(HAIRCUTS.length - 1), color: z.number().int().min(0).max(HAIR_COLORS.length - 1) }),
  z.object({ t: z.literal('chat'), text: z.string().trim().min(1).max(160) }),
]);
export type ClientMsg = z.infer<typeof ClientMsg>;
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
export type ServerMsg =
  | { t: 'welcome'; token: string; id: string } | { t: 'error'; msg: string } | { t: 'kicked'; msg: string }
  | { t: 'self'; s: SelfState } | { t: 'snap'; tick: number; map: MapId; reset?: boolean; ents: Ent[]; gone: string[]; ev: GameEvent[] }
  | { t: 'chat'; from: string; text: string } | { t: 'info'; text: string; kind?: 'unique' | 'boss' | 'level' | 'bad' }
  | { t: 'xp'; skill: Skill; amount: number } | { t: 'open'; station: StationType }
  | { t: 'boss'; alive: boolean; next: number; contrib: number; online: number };
export function decodeClient(raw: string): ClientMsg | null {
  try { const r = ClientMsg.safeParse(JSON.parse(raw)); return r.success ? r.data : null; } catch { return null; }
}
export const encode = (m: ServerMsg | ClientMsg) => JSON.stringify(m);
