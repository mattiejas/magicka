import { MAPS, bossMaxHp, inReach, rectDist, ticks, walkable, type BossAttack } from '@magicka/shared';
import { hurtPlayer, rectOf } from './combat';
import type { Monster, Player } from './types';
import type { World } from './world';
/** Contribution is a fraction of total health at the moment of the hit, so scaling cannot distort it. */
export function afterBossDamage(_w: World, m: Monster, id: string, dmg: number) { m.dmg.set(id, (m.dmg.get(id) ?? 0) + dmg / m.mhp); }
export const bossShare = (m: Monster) => [...m.dmg].filter(e => e[1] > 0.02).map(e => e[0]);
const near = (w: World, m: Monster): Player[] => [...w.players.values()].filter(p => p.c.map === m.map && !w.isSafe(p) && rectDist(p.c.x, p.c.y, rectOf(m)) <= m.def.boss!.arena);
function rescale(w: World, m: Monster) {
  for (const [id, t] of m.active) { const p = w.players.get(id); if (w.tick - t > ticks(20) || !p || p.c.map !== m.map) m.active.delete(id); }
  if (!m.active.size) return;
  const mhp = bossMaxHp(m.def.boss!.baseHp, m.active.size);
  if (mhp !== m.mhp) { m.hp = (m.hp / m.mhp) * mhp; m.mhp = mhp; }
}
function tilesFor(w: World, m: Monster, a: BossAttack, ps: Player[]): [number, number][] {
  const map = MAPS[m.map], out = new Map<string, [number, number]>(), put = (x: number, y: number) => { if (walkable(map, x, y)) out.set(`${x},${y}`, [x, y]); };
  if (a.id === 'quake') {
    const R = rectOf(m), ar = m.def.boss!.arena, parity = w.rnd() < 0.5 ? 0 : 1;
    for (let y = m.y - ar; y < m.y + m.def.size + ar; y++) for (let x = m.x - ar; x < m.x + m.def.size + ar; x++) { const d = rectDist(x, y, R); if (d > 0 && d <= ar && ((d - 1) >> 1) % 2 === parity) put(x, y); }
    return [...out.values()];
  }
  const pool = [...ps]; for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(w.rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (const p of pool.slice(0, a.count ?? 1)) {
    const r = a.id === 'boulder' ? 1 : 0;
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) put(p.c.x + i, p.c.y + j);
    if (a.id === 'vines') for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(p.c.x + i, p.c.y + j);
  }
  return [...out.values()];
}
/** choose -> windup -> execute, looping. Everything about the attack is fixed at choose. */
export function bossAi(w: World, m: Monster) {
  const b = m.boss!, ps = near(w, m);
  rescale(w, m);
  if (b.st === 'choose') {
    if (!ps.length) {
      if (m.dmg.size && !m.active.size) { m.dmg.clear(); m.mhp = m.def.boss!.baseHp; m.hp = m.mhp; }
      return;
    }
    // Only fight once provoked, or when someone steps close.
    if (!m.active.size && !ps.some(p => inReach(p.c.x, p.c.y, rectOf(m), 4))) return;
    const close = ps.filter(p => inReach(p.c.x, p.c.y, rectOf(m), 1));
    const opts = m.def.boss!.attacks.filter(a => a.id !== 'melee' || close.length);
    let r = w.rnd() * opts.reduce((s, a) => s + a.weight, 0);
    const a = opts.find(a => (r -= a.weight) < 0) ?? opts[0];
    b.atk = a; b.st = 'windup'; b.start = w.tick; b.end = w.tick + a.windup;
    b.tgt = a.id === 'melee' ? close[Math.floor(w.rnd() * close.length)].id : null;
    b.tiles = a.id === 'melee' ? [] : tilesFor(w, m, a, ps);
    return;
  }
  if (w.tick < b.end) return;
  if (b.st === 'execute') { b.st = 'choose'; b.atk = null; b.tiles = []; b.tgt = null; return; }
  const a = b.atk!;
  b.st = 'execute'; b.start = w.tick; b.end = w.tick + a.execute;
  const dmg = () => a.damage[0] + Math.floor(w.rnd() * (a.damage[1] - a.damage[0] + 1));
  const set = new Set(b.tiles.map(t => t.join()));
  const victims = a.id === 'melee' ? ps.filter(p => p.id === b.tgt && inReach(p.c.x, p.c.y, rectOf(m), 1)) : ps.filter(p => set.has(`${p.c.x},${p.c.y}`));
  w.event(m.map, m.x, m.y, { e: 'impact', boss: m.id, atk: a.id, tiles: b.tiles });
  for (const p of victims) {
    m.active.set(p.id, w.tick);
    if (a.root) { p.rootedUntil = w.tick + a.root; p.path = []; }
    w.addXp(p, 'defence', 6 + m.def.level);
    hurtPlayer(w, p, m.id, dmg(), a.id);
  }
}
export function resetBoss(m: Monster) { m.mhp = m.def.boss!.baseHp; m.hp = m.mhp; m.dmg.clear(); m.active.clear(); m.boss = { st: 'choose', atk: null, tiles: [], start: 0, end: 0, tgt: null }; }
