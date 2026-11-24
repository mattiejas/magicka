import { INV_SIZE, ITEMS, SKILLS, levelForXp, maxHp, type Skill, type Slot, type Stack } from '@magicka/shared';
import type { Player, SavedChar } from './types';
export function newChar(): SavedChar {
  const xp = Object.fromEntries(SKILLS.map(s => [s, 0])) as Record<Skill, number>;
  const inv: (Stack | null)[] = Array(INV_SIZE).fill(null);
  ['worn_pickaxe', 'worn_axe', 'worn_sword'].forEach((id, i) => (inv[i] = { id, qty: 1 }));
  return { map: 'island', x: 32, y: 35, hp: maxHp(1), xp, inv, equip: {}, bank: [], boat: {}, boatDone: false, grave: null, look: null };
}
export const level = (p: Player, s: Skill) => levelForXp(p.c.xp[s]);
export const count = (p: Player, id: string) => p.c.inv.reduce((n, s) => n + (s?.id === id ? s.qty : 0), 0);
export const addTo = (list: Stack[], id: string, qty: number) => { const s = list.find(s => s.id === id); if (s) s.qty += qty; else list.push({ id, qty }); };
/** Adds as many as fit; returns how many were added. */
export function give(p: Player, id: string, qty: number): number {
  const inv = p.c.inv;
  if (ITEMS[id].stack) {
    const s = inv.find(s => s?.id === id);
    if (s) s.qty += qty;
    else { const i = inv.indexOf(null); if (i < 0) return 0; inv[i] = { id, qty }; }
    p.dirty = true; return qty;
  }
  let n = 0;
  for (let i = 0; i < inv.length && n < qty; i++) if (!inv[i]) { inv[i] = { id, qty: 1 }; n++; }
  if (n) p.dirty = true;
  return n;
}
/** All or nothing. */
export function take(p: Player, id: string, qty: number): boolean {
  if (count(p, id) < qty) return false;
  for (let i = 0; i < p.c.inv.length && qty > 0; i++) {
    const s = p.c.inv[i]; if (s?.id !== id) continue;
    const n = Math.min(qty, s.qty); s.qty -= n; qty -= n; if (!s.qty) p.c.inv[i] = null;
  }
  p.dirty = true; return true;
}
export function unmet(p: Player, id: string): string | null {
  for (const [s, l] of Object.entries(ITEMS[id].req ?? {})) if (level(p, s as Skill) < l) return `You need ${s} level ${l} to use that.`;
  return null;
}
export function equip(p: Player, i: number): string | null {
  const s = p.c.inv[i]; if (!s) return null;
  const it = ITEMS[s.id]; if (!it.slot) return 'You cannot equip that.';
  const why = unmet(p, s.id); if (why) return why;
  const old = p.c.equip[it.slot];
  if (old && old.id === s.id && it.stack) { old.qty += s.qty; p.c.inv[i] = null; }
  else {
    // A stackable going back may merge with an existing inventory stack.
    const merge = old && ITEMS[old.id].stack ? p.c.inv.find((o, j) => j !== i && o?.id === old.id) : null;
    if (merge) { merge.qty += old!.qty; p.c.inv[i] = null; } else p.c.inv[i] = old ?? null;
    p.c.equip[it.slot] = s;
  }
  p.dirty = true; return null;
}
export function unequip(p: Player, slot: Slot): string | null {
  const s = p.c.equip[slot]; if (!s) return null;
  if (give(p, s.id, s.qty) < s.qty) return 'Your inventory is full.';
  delete p.c.equip[slot]; p.dirty = true; return null;
}
export function deposit(p: Player, id: string, qty: number) {
  const n = Math.min(qty, count(p, id)); if (n > 0 && take(p, id, n)) addTo(p.c.bank, id, n);
}
export function withdraw(p: Player, id: string, qty: number) {
  const s = p.c.bank.find(s => s.id === id); if (!s) return;
  const n = give(p, id, Math.min(qty, s.qty)); s.qty -= n;
  if (!s.qty) p.c.bank.splice(p.c.bank.indexOf(s), 1);
  p.dirty = true;
}
export const bestTool = (p: Player, kind: 'pickaxe' | 'axe'): number => {
  let best = -1;
  for (const s of p.c.inv) if (s && ITEMS[s.id].tool === kind && !unmet(p, s.id)) best = Math.max(best, ITEMS[s.id].tier);
  return best;
};
