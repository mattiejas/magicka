import { ITEMS, MAPS, hitChance, inReach, maxHit, maxHp, rectDist, styleModifier, ticks, walkable, type LootTable, type Skill, type Style } from '@magicka/shared';
import { addTo, give, level, take } from './inventory';
import type { Monster, Player } from './types';
import type { World } from './world';
import { afterBossDamage, bossShare } from './bosses';
export const rectOf = (m: Monster) => ({ x: m.x, y: m.y, w: m.def.size, h: m.def.size });
export function stats(p: Player) {
  const wp = p.c.equip.weapon ? ITEMS[p.c.equip.weapon.id] : null;
  let acc = 0, power = 0, armour = 0;
  for (const [slot, s] of Object.entries(p.c.equip)) { const i = ITEMS[s!.id]; if (slot === 'ammo') continue; acc += i.acc ?? 0; power += i.power ?? 0; armour += i.armour ?? 0; }
  return { style: (wp?.style ?? 'melee') as Style, acc, power, armour, speed: wp?.speed ?? 4, range: wp?.range ?? 1, tier: wp?.tier ?? 0 };
}
/** Finds usable ammunition: equipped first, then carried. Returns its power, or null when there is none. */
function useAmmo(p: Player, kind: 'arrow' | 'essence', maxTier: number): number | null {
  const e = p.c.equip.ammo;
  if (e && ITEMS[e.id].ammo === kind && ITEMS[e.id].tier <= maxTier) { if (--e.qty <= 0) delete p.c.equip.ammo; p.dirty = true; return ITEMS[e.id].power ?? 0; }
  const best = p.c.inv.filter(s => s && ITEMS[s.id].ammo === kind && ITEMS[s.id].tier <= maxTier).sort((a, b) => ITEMS[b!.id].tier - ITEMS[a!.id].tier)[0];
  if (!best) return null;
  const pw = ITEMS[best.id].power ?? 0; take(p, best.id, 1); return pw;
}
export function playerAttack(w: World, p: Player, m: Monster) {
  const s = stats(p);
  p.act = s.style;
  if (p.nextAttack > w.tick) return;
  let bonus = 0;
  if (s.style !== 'melee') {
    const a = useAmmo(p, s.style === 'ranged' ? 'arrow' : 'essence', Math.max(1, s.tier));
    if (a === null) { w.info(p, s.style === 'ranged' ? 'You have no arrows for this bow.' : 'You have no essence.'); return w.stop(p); }
    bonus = a;
  }
  p.nextAttack = w.tick + s.speed; p.lastCombat = w.tick;
  const lv = level(p, s.style as Skill), d = m.def;
  const mod = styleModifier(s.style, d.boss?.world ? null : d.style);
  const hit = w.rnd() < hitChance(lv, s.acc, d.level, d.armour, mod);
  const dmg = hit ? Math.min(Math.ceil(m.hp), 1 + Math.floor(w.rnd() * maxHit(lv, s.power + bonus))) : 0;
  w.event(p.c.map, m.x, m.y, { e: 'hit', from: p.id, to: m.id, dmg, style: s.style });
  if (!m.target && !d.boss) m.target = p.id;
  if (d.boss) { m.active.set(p.id, w.tick); }
  if (!dmg) return;
  if (d.boss) afterBossDamage(w, m, p.id, dmg); else m.dmg.set(p.id, (m.dmg.get(p.id) ?? 0) + dmg);
  m.hp -= dmg;
  w.addXp(p, s.style as Skill, dmg * 4); w.addXp(p, 'vitality', dmg * 1.5);
  if (m.hp <= 0.001) kill(w, m);
}
export function rollLoot(rnd: () => number, t: LootTable): [string, number, boolean][] {
  const out: [string, number, boolean][] = [], n = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  for (const [i, a, b] of t.always ?? []) out.push([i, n(a, b), false]);
  if (t.common?.length) { const [i, a, b] = t.common[Math.floor(rnd() * t.common.length)]; out.push([i, n(a, b), false]); }
  for (const [i, q, c] of t.rare ?? []) if (rnd() < c) out.push([i, q, false]);
  for (const [i, c] of t.unique ?? []) if (rnd() < c) out.push([i, 1, true]);
  return out;
}
function kill(w: World, m: Monster) {
  m.dead = true; m.hp = 0; m.target = null; m.respawnAt = w.tick + ticks(m.def.respawn);
  w.event(m.map, m.x, m.y, { e: 'death', id: m.id });
  w.vacate(m);
  if (m.def.boss?.world) w.worldBossDied(m);
  const winners = m.def.boss ? bossShare(m) : [...m.dmg].sort((a, b) => b[1] - a[1]).slice(0, 1).map(e => e[0]);
  const priv = m.def.boss ? 180 : 60, tail = m.def.boss ? 300 : 120;
  for (const id of winners) {
    const p = w.players.get(id); let k = 0;
    for (const [item, qty, unique] of rollLoot(w.rnd, m.def.loot)) {
      let x = m.x + (m.def.size > 1 ? (k++ % m.def.size) : 0), y = m.y;
      if (!walkable(MAPS[m.map], x, y)) { x = m.x; y = m.y; }
      w.drop(m.map, x, y, item, qty, id, w.tick + ticks(priv), w.tick + ticks(priv + tail));
      if (unique) w.broadcast({ t: 'info', kind: 'unique', text: `${p?.name ?? 'An adventurer'} received ${ITEMS[item].name} from ${m.def.name}.` });
    }
  }
  m.dmg.clear(); m.active.clear();
}
export function hurtPlayer(w: World, p: Player, from: string, dmg: number, style: string) {
  const c = p.c; dmg = Math.min(dmg, c.hp); c.hp -= dmg; p.lastCombat = w.tick;
  w.event(c.map, c.x, c.y, { e: 'hit', from, to: p.id, dmg, style });
  if (c.hp <= 0) die(w, p); else p.dirty = true;
}
function die(w: World, p: Player) {
  const c = p.c, items = c.grave?.items ?? [];
  c.inv.forEach((s, i) => { if (s) addTo(items, s.id, s.qty); c.inv[i] = null; });
  if (items.length) c.grave = { map: c.map, x: c.x, y: c.y, items };
  w.event(c.map, c.x, c.y, { e: 'death', id: p.id });
  const m = MAPS[c.map]; c.x = m.spawn.x; c.y = m.spawn.y; c.hp = maxHp(level(p, 'vitality'));
  w.stop(p); p.via = []; p.rootedUntil = 0; p.lastCombat = -999; p.dirty = true;
  for (const o of w.monsters.values()) { if (o.target === p.id) o.target = null; o.active.delete(p.id); }
  w.info(p, items.length ? 'You died. Your carried items are safe at your grave or with the reaper.' : 'You died.', 'bad');
  w.save([p]);
}
export function claimGrave(w: World, p: Player) {
  const g = p.c.grave; if (!g) return w.info(p, 'The reaper holds nothing of yours.');
  for (const s of [...g.items]) { s.qty -= (ITEMS[s.id].stack || p.c.inv.includes(null)) ? give(p, s.id, s.qty) : 0; if (!s.qty) g.items.splice(g.items.indexOf(s), 1); }
  if (!g.items.length) p.c.grave = null; else w.info(p, 'Your inventory is full. The rest is kept for you.');
  p.dirty = true; w.save([p]);
}
export function monsterAi(w: World, m: Monster) {
  m.via = [];
  const d = m.def;
  let t = m.target ? w.players.get(m.target) : undefined;
  const home = Math.max(Math.abs(m.x - m.sx), Math.abs(m.y - m.sy));
  if (t && (t.c.map !== m.map || home > 10 || w.isSafe(t))) { t = undefined; m.target = null; m.hp = m.mhp; m.dmg.clear(); }
  if (!t && d.aggro && home <= 4) {
    for (const p of w.players.values()) if (p.c.map === m.map && !w.isSafe(p) && rectDist(p.c.x, p.c.y, rectOf(m)) <= d.aggro) { m.target = p.id; t = p; break; }
  }
  if (!t) {
    if (home > 4) return step(w, m, m.sx, m.sy);
    if (w.rnd() < 0.08) step(w, m, m.x + Math.floor(w.rnd() * 3) - 1, m.y + Math.floor(w.rnd() * 3) - 1);
    return;
  }
  if (!inReach(t.c.x, t.c.y, rectOf(m), d.range)) return step(w, m, t.c.x, t.c.y);
  if (m.nextAttack > w.tick) return;
  m.nextAttack = w.tick + d.speed;
  const s = stats(t), def = level(t, 'defence');
  const hit = w.rnd() < hitChance(d.level, d.acc, def, s.armour, styleModifier(d.style, s.style));
  w.addXp(t, 'defence', 3 + d.level * 0.8);
  // an attacked idle player fights back
  if (!t.action && t.nextAct < w.tick) t.action = { type: 'attack', id: m.id };
  hurtPlayer(w, t, m.id, hit ? 1 + Math.floor(w.rnd() * maxHit(d.level, d.power)) : 0, d.style);
}
function step(w: World, m: Monster, tx: number, ty: number) {
  const map = MAPS[m.map], dx = Math.sign(tx - m.x), dy = Math.sign(ty - m.y);
  for (const [a, b] of [[dx, dy], [dx, 0], [0, dy]]) {
    if (!a && !b) continue;
    const x = m.x + a, y = m.y + b;
    if (!walkable(map, x, y) || (a && b && (!walkable(map, x, m.y) || !walkable(map, m.x, y))) || w.monsterAt(m.map, x, y)) continue;
    w.moveMonster(m, x, y); return;
  }
}
