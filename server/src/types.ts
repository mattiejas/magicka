import type { BossAttack, GameEvent, GameMap, MapId, MonsterDef, ServerMsg, Skill, Slot, Stack } from '@magicka/shared';
export interface Grave { map: MapId; x: number; y: number; items: Stack[] }
export interface SavedChar {
  map: MapId; x: number; y: number; hp: number; xp: Record<Skill, number>; inv: (Stack | null)[]; equip: Partial<Record<Slot, Stack>>;
  bank: Stack[]; boat: Record<string, number>; boatDone: boolean; grave: Grave | null;
}
export type Action =
  | { type: 'move'; x: number; y: number } | { type: 'gather'; id: string } | { type: 'station'; id: string } | { type: 'attack'; id: string }
  | { type: 'pickup'; id: string } | { type: 'grave' } | { type: 'craft'; id: string; left: number };
export interface Player {
  id: string; account: number; name: string; c: SavedChar; action: Action | null; path: [number, number][]; via: [number, number][];
  nextAct: number; nextAttack: number; rootedUntil: number; lastCombat: number; dirty: boolean; send: ((m: ServerMsg) => void) | null;
  disconnectedAt: number | null; known: Map<string, string>; knownMap: MapId | null; warned: string; act: string; loggingOut: boolean;
}
export interface Monster {
  id: string; def: MonsterDef; map: MapId; x: number; y: number; sx: number; sy: number; hp: number; mhp: number; dead: boolean; respawnAt: number;
  target: string | null; nextAttack: number; via: [number, number][]; dmg: Map<string, number>; active: Map<string, number>;
  boss?: { st: 'choose' | 'windup' | 'execute'; atk: BossAttack | null; tiles: [number, number][]; start: number; end: number; tgt: string | null };
}
export interface Drop { id: string; map: MapId; x: number; y: number; item: string; qty: number; owner: string | null; publicAt: number; expires: number }
export type Ev = { map: MapId; x: number; y: number; ev: GameEvent };
export type { GameMap };
