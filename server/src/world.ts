import { GAME_NAME, ITEMS, MAPS, MONSTERS, RECIPES, SKILLS, findPath, inReach, maxHp, rectDist, ticks, xpForLevel, MAX_LEVEL, type ClientMsg, type Ent, type GameEvent, type MapId, type Rect, type ServerMsg, type Skill, type StationType } from '@magicka/shared';
import { bossAi, resetBoss } from './bosses';
import { claimGrave, monsterAi, playerAttack, rectOf, stats } from './combat';
import { deposit, equip, level, newChar, unequip, withdraw } from './inventory';
import { buildBoat, craft, gather } from './skilling';
import type { Action, Drop, Ev, Monster, Player, SavedChar } from './types';
export interface Store { saveMany(l: [number, SavedChar][]): void }
export const VIEW = 24, BOSS_PERIOD = ticks(600), LINGER = ticks(30);
export class World {
  tick = 0; players = new Map<string, Player>(); monsters = new Map<string, Monster>(); drops = new Map<string, Drop>();
  nodes = new Map<string, { id: string; type: string; map: MapId; x: number; y: number; depletedUntil: number }>();
  private queue: [string, ClientMsg][] = []; private events: Ev[] = []; private seq = 0; private occ = new Map<string, string>();
  nextBoss: number;
  constructor(private store: Store, public rnd: () => number = Math.random, public dev = false, bossPeriod = BOSS_PERIOD) {
    this.bossPeriod = bossPeriod; this.nextBoss = bossPeriod;
    for (const m of Object.values(MAPS)) {
      for (const n of m.nodes) this.nodes.set(n.id, { ...n, map: m.id, depletedUntil: 0 });
      m.spawns.forEach((s, i) => {
        const def = MONSTERS[s.type], id = `${m.id}:m${i}`;
        const mo: Monster = { id, def, map: m.id, x: s.x, y: s.y, sx: s.x, sy: s.y, hp: def.hp, mhp: def.hp, dead: !!def.boss?.world, respawnAt: Infinity, target: null, nextAttack: 0, via: [], dmg: new Map(), active: new Map() };
        if (def.boss) resetBoss(mo);
        this.monsters.set(id, mo); if (!mo.dead) this.occ.set(`${m.id},${s.x},${s.y}`, id);
      });
    }
  }
  private bossPeriod: number;
  worldBoss() { return [...this.monsters.values()].find(m => m.def.boss?.world)!; }
  // --- connections
  join(account: number, name: string, saved: SavedChar | null, send: (m: ServerMsg) => void): Player {
    const id = `p${account}`; let p = this.players.get(id);
    if (p) { p.send?.({ t: 'kicked', msg: 'You logged in somewhere else.' }); }
    else {
      const fresh = newChar(), c: SavedChar = saved ? { ...fresh, ...saved } : fresh;
      for (const s of SKILLS) c.xp[s] ??= 0;
      p = { id, account, name, c, action: null, path: [], via: [], nextAct: 0, nextAttack: 0, rootedUntil: 0, lastCombat: -999, dirty: true, send: null, disconnectedAt: null, known: new Map(), knownMap: null, warned: '', act: '', loggingOut: false };
      this.players.set(id, p);
    }
    p.send = send; p.disconnectedAt = null; p.known = new Map(); p.knownMap = null; p.dirty = true;
    if (!saved) this.info(p, `Welcome to ${GAME_NAME}. Click a copper rock or an ash tree to begin.`);
    this.bossInfo(p);
    return p;
  }
  /** Only the connection that currently owns the player may detach it. */
  leave(p: Player, send: (m: ServerMsg) => void) { if (p.send === send) { p.send = null; p.disconnectedAt = this.tick; } }
  enqueue(id: string, m: ClientMsg) { this.queue.push([id, m]); }
  save(list: Iterable<Player>) { this.store.saveMany([...list].map(p => [p.account, p.c])); }
  // --- helpers
  info(p: Player, text: string, kind?: 'unique' | 'boss' | 'level' | 'bad') { p.send?.({ t: 'info', text, kind }); }
  broadcast(m: ServerMsg) { for (const p of this.players.values()) p.send?.(m); }
  event(map: MapId, x: number, y: number, ev: GameEvent) { this.events.push({ map, x, y, ev }); }
  stop(p: Player) { p.action = null; p.path = []; }
  isSafe(p: Player) { const s = MAPS[p.c.map].safe; return Math.hypot(p.c.x - s.x, p.c.y - s.y) <= s.r; }
  monsterAt(map: MapId, x: number, y: number) { return this.occ.get(`${map},${x},${y}`); }
  vacate(m: Monster) { this.occ.delete(`${m.map},${m.x},${m.y}`); }
  moveMonster(m: Monster, x: number, y: number) { this.occ.delete(`${m.map},${m.x},${m.y}`); m.x = x; m.y = y; m.via = [[x, y]]; this.occ.set(`${m.map},${x},${y}`, m.id); }
  addXp(p: Player, s: Skill, amount: number) {
    const before = level(p, s); amount = Math.round(amount);
    p.c.xp[s] = Math.min(xpForLevel(MAX_LEVEL), p.c.xp[s] + amount); p.dirty = true;
    p.send?.({ t: 'xp', skill: s, amount });
    const now = level(p, s);
    if (now > before) { this.info(p, `${s[0].toUpperCase() + s.slice(1)} is now level ${now}.`, 'level'); if (s === 'vitality') p.c.hp += 3 * (now - before); }
  }
  drop(map: MapId, x: number, y: number, item: string, qty: number, owner: string | null, publicAt: number, expires: number) {
    const n = ITEMS[item].stack ? 1 : qty;
    for (let i = 0; i < n; i++) { const id = `d${++this.seq}`; this.drops.set(id, { id, map, x, y, item, qty: ITEMS[item].stack ? qty : 1, owner, publicAt, expires }); }
  }
  nearStation(p: Player, type: StationType) { const s = MAPS[p.c.map].stations.find(s => s.type === type); return !!s && inReach(p.c.x, p.c.y, { ...s, w: 1, h: 1 }, 2); }
  worldBossDied(m: Monster) { this.nextBoss = Math.max(this.nextBoss, this.tick + 1); m.respawnAt = Infinity; this.broadcast({ t: 'info', kind: 'boss', text: `${m.def.name} has fallen.` }); }
  spawnWorldBoss() {
    const m = this.worldBoss(); if (!m.dead) return;
    resetBoss(m); m.dead = false; this.occ.set(`${m.map},${m.x},${m.y}`, m.id);
    this.broadcast({ t: 'info', kind: 'boss', text: `${m.def.name} rises in the Rooted arena on the mainland.` });
  }
  private bossInfo(p: Player) {
    const m = this.worldBoss();
    p.send?.({ t: 'boss', alive: !m.dead, next: Math.max(0, this.nextBoss - this.tick), contrib: m.dmg.get(p.id) ?? 0, online: this.players.size });
  }
  // --- intents
  private setAction(p: Player, a: Action | null) { p.action = a; p.path = []; }
  private handle(p: Player, m: ClientMsg) {
    const c = p.c, say = (s: string | null) => { if (s) this.info(p, s); };
    switch (m.t) {
      case 'move': if (m.x < MAPS[c.map].size && m.y < MAPS[c.map].size) { this.setAction(p, { type: 'move', x: m.x, y: m.y }); p.path = findPath(MAPS[c.map], c.x, c.y, { x: m.x, y: m.y, w: 1, h: 1 }); } break;
      case 'gather': case 'station': case 'attack': case 'pickup': this.setAction(p, { type: m.t, id: m.id }); break;
      case 'grave': this.setAction(p, { type: 'grave' }); break;
      case 'claim': if (this.nearStation(p, 'reaper')) claimGrave(this, p); break;
      case 'craft': { const r = RECIPES.find(r => r.id === m.id); if (r && this.nearStation(p, r.station)) { p.nextAct = this.tick - 2; this.setAction(p, { type: 'craft', id: m.id, left: m.qty }); } break; }
      case 'equip': say(equip(p, m.slot)); break;
      case 'unequip': say(unequip(p, m.slot)); break;
      case 'swap': [c.inv[m.a], c.inv[m.b]] = [c.inv[m.b], c.inv[m.a]]; p.dirty = true; break;
      case 'eat': {
        const s = c.inv[m.slot], heal = s && ITEMS[s.id].heal; if (!heal) break;
        if (p.nextAct > this.tick && p.act === 'eat') break;
        c.inv[m.slot] = null; c.hp = Math.min(maxHp(level(p, 'vitality')), c.hp + heal);
        p.nextAttack = Math.max(p.nextAttack, this.tick) + 2; p.act = 'eat'; p.nextAct = this.tick + 2; p.dirty = true; break;
      }
      case 'drop': { const s = c.inv[m.slot]; if (s) { c.inv[m.slot] = null; p.dirty = true; this.drop(c.map, c.x, c.y, s.id, s.qty, p.id, this.tick + ticks(60), this.tick + ticks(180)); } break; }
      case 'bank': if (ITEMS[m.item] && this.nearStation(p, 'bank')) { (m.op === 'deposit' ? deposit : withdraw)(p, m.item, m.qty); this.save([p]); } break;
      case 'depositAll': if (this.nearStation(p, 'bank')) { for (const s of [...c.inv]) if (s) deposit(p, s.id, s.qty); this.save([p]); } break;
      case 'boat':
        if (!this.nearStation(p, 'dock')) break;
        if (m.op === 'build') { if (!c.boatDone) buildBoat(this, p); }
        else if (!c.boatDone) this.info(p, 'Your boat is not finished.');
        else { c.map = c.map === 'island' ? 'mainland' : 'island'; const l = MAPS[c.map].landing; c.x = l.x; c.y = l.y; this.stop(p); p.via = []; p.dirty = true; this.save([p]); }
        break;
      case 'chat': if (m.text[0] === '/' && this.dev) this.devCmd(p, m.text.slice(1).split(' ')); else this.broadcast({ t: 'chat', from: p.name, text: m.text }); break;
    }
  }
  private devCmd(p: Player, [cmd, a, b]: string[]) {
    const n = Math.max(0, Math.min(100000, Number(b) || 1));
    if (cmd === 'give' && ITEMS[a]) { let left = n; while (left > 0) { const s = p.c.inv.indexOf(null); if (s < 0 && !ITEMS[a].stack) break; const put = ITEMS[a].stack ? left : 1; const hit = ITEMS[a].stack ? p.c.inv.find(i => i?.id === a) : null; if (hit) hit.qty += put; else if (s >= 0) p.c.inv[s] = { id: a, qty: put }; else break; left -= put; } }
    if (cmd === 'level') for (const s of SKILLS) if (s === a || a === 'all') p.c.xp[s] = xpForLevel(Math.min(MAX_LEVEL, Math.max(1, n)));
    if (cmd === 'tp') { const [x, y] = [Number(a), Number(b)]; if (Number.isInteger(x) && Number.isInteger(y)) { p.c.x = x; p.c.y = y; this.stop(p); } }
    if (cmd === 'map' && (a === 'island' || a === 'mainland')) { p.c.map = a; p.c.x = MAPS[a].landing.x; p.c.y = MAPS[a].landing.y; this.stop(p); }
    if (cmd === 'boss') this.spawnWorldBoss();
    if (cmd === 'heal') p.c.hp = maxHp(level(p, 'vitality'));
    if (cmd === 'die') { p.c.hp = 1; }
    p.dirty = true;
  }
  // --- tick
  private target(p: Player): { rect: Rect; reach: number } | null {
    const a = p.action!, one = (o: { x: number; y: number }) => ({ x: o.x, y: o.y, w: 1, h: 1 });
    if (a.type === 'gather') { const n = this.nodes.get(a.id); return n && n.map === p.c.map ? { rect: one(n), reach: 1 } : null; }
    if (a.type === 'station') { const s = MAPS[p.c.map].stations.find(s => s.id === a.id); return s ? { rect: one(s), reach: 1 } : null; }
    if (a.type === 'attack') { const m = this.monsters.get(a.id); return m && !m.dead && m.map === p.c.map ? { rect: rectOf(m), reach: stats(p).range } : null; }
    if (a.type === 'pickup') { const d = this.drops.get(a.id); return d && d.map === p.c.map && (d.owner === p.id || d.publicAt <= this.tick) ? { rect: one(d), reach: 0 } : null; }
    if (a.type === 'grave') { const g = p.c.grave; return g && g.map === p.c.map ? { rect: one(g), reach: 1 } : null; }
    return null;
  }
  private actPlayer(p: Player) {
    p.via = []; p.act = p.act === 'eat' && p.nextAct > this.tick ? 'eat' : '';
    const a = p.action; if (!a) return;
    const c = p.c, rooted = p.rootedUntil > this.tick;
    if (a.type === 'craft') return craft(this, p, a);
    if (a.type !== 'move') {
      const t = this.target(p); if (!t) return this.stop(p);
      if (!inReach(c.x, c.y, t.rect, t.reach)) {
        if (rooted) return;
        if (!p.path.length || a.type === 'attack') p.path = findPath(MAPS[c.map], c.x, c.y, t.rect, t.reach);
        if (!p.path.length) { this.info(p, 'You cannot reach that.'); return this.stop(p); }
        this.walk(p);
        if (!inReach(c.x, c.y, t.rect, t.reach)) return;
      }
      p.path = [];
      switch (a.type) {
        case 'gather': return gather(this, p, a.id);
        case 'attack': return playerAttack(this, p, this.monsters.get(a.id)!);
        case 'station': { const s = MAPS[c.map].stations.find(s => s.id === a.id)!; this.stop(p); p.send?.({ t: 'open', station: s.type }); return; }
        case 'grave': this.stop(p); return claimGrave(this, p);
        case 'pickup': return this.pickup(p, a.id);
      }
    }
    if (rooted) return;
    this.walk(p); if (!p.path.length) p.action = null;
  }
  private walk(p: Player) { for (let i = 0; i < 2 && p.path.length; i++) { const s = p.path.shift()!; p.c.x = s[0]; p.c.y = s[1]; p.via.push(s); } }
  private pickup(p: Player, id: string) {
    const d = this.drops.get(id)!; this.stop(p);
    const empty = p.c.inv.indexOf(null), stack = ITEMS[d.item].stack ? p.c.inv.find(s => s?.id === d.item) : null;
    if (empty < 0 && !stack) return this.info(p, 'Your inventory is full.');
    if (stack) stack.qty += d.qty; else p.c.inv[empty] = { id: d.item, qty: d.qty };
    this.drops.delete(id); p.dirty = true; this.save([p]);
  }
  step() {
    this.tick++;
    const q = this.queue; this.queue = [];
    for (const [id, m] of q) { const p = this.players.get(id); if (p) this.handle(p, m); }
    for (const p of this.players.values()) this.actPlayer(p);
    for (const m of this.monsters.values()) {
      if (m.dead) { if (this.tick >= m.respawnAt) { m.dead = false; m.x = m.sx; m.y = m.sy; m.hp = m.mhp; m.target = null; m.via = []; if (m.def.boss) resetBoss(m); this.occ.set(`${m.map},${m.x},${m.y}`, m.id); } continue; }
      if (m.def.boss) bossAi(this, m); else monsterAi(this, m);
    }
    if (this.tick >= this.nextBoss) { this.nextBoss = this.tick + this.bossPeriod; this.spawnWorldBoss(); }
    for (const d of this.drops.values()) if (d.expires <= this.tick) this.drops.delete(d.id);
    if (this.tick % 10 === 0) for (const p of this.players.values()) { const mx = maxHp(level(p, 'vitality')); if (p.c.hp < mx) { p.c.hp = Math.min(mx, p.c.hp + 1 + Math.floor(mx / 60)); p.dirty = true; } }
    for (const p of this.players.values()) if (p.disconnectedAt !== null && (this.tick - p.lastCombat > ticks(10) || this.tick - p.disconnectedAt >= LINGER)) { this.save([p]); this.players.delete(p.id); }
    if (this.tick % ticks(30) === 0) this.save(this.players.values());
    this.snapshot();
  }
  private snapshot() {
    const ents: { map: MapId; e: Ent; s: string; owner?: string | null }[] = [];
    const add = (map: MapId, e: Ent, owner?: string | null) => ents.push({ map, e, s: JSON.stringify(e), owner });
    for (const p of this.players.values()) {
      const g = p.c.equip, a = p.action;
      add(p.c.map, { id: p.id, k: 'p', x: p.c.x, y: p.c.y, via: p.via.length ? p.via : undefined, name: p.name, hp: p.c.hp, mhp: maxHp(level(p, 'vitality')), act: p.act || undefined, tgt: a && 'id' in a && a.type !== 'craft' ? a.id : undefined, rooted: p.rootedUntil > this.tick || undefined, gear: [g.weapon?.id ?? null, g.head?.id ?? null, g.body?.id ?? null, g.legs?.id ?? null], lvl: Math.max(level(p, 'melee'), level(p, 'ranged'), level(p, 'magic')) });
    }
    for (const m of this.monsters.values()) if (!m.dead) add(m.map, { id: m.id, k: 'm', type: m.def.id, x: m.x, y: m.y, via: m.via.length ? m.via : undefined, hp: Math.ceil(m.hp), mhp: m.mhp, tgt: m.target ?? undefined, boss: m.boss ? { st: m.boss.st, atk: m.boss.atk?.id, tiles: m.boss.tiles, start: m.boss.start, end: m.boss.end, tgt: m.boss.tgt ?? undefined } : undefined });
    for (const n of this.nodes.values()) if (n.depletedUntil > this.tick) add(n.map, { id: n.id, k: 'n', x: n.x, y: n.y });
    for (const d of this.drops.values()) add(d.map, { id: d.id, k: 'd', type: d.item, qty: d.qty, x: d.x, y: d.y }, d.publicAt <= this.tick ? null : d.owner);
    for (const p of this.players.values()) {
      if (!p.send) continue;
      if (p.dirty) { const c = p.c; p.dirty = false; p.send({ t: 'self', s: { id: p.id, name: p.name, map: c.map, xp: c.xp, inv: c.inv, equip: c.equip, bank: c.bank, boat: c.boat, boatDone: c.boatDone, reaper: c.grave?.items ?? [] } }); }
      const reset = p.knownMap !== p.c.map; if (reset) { p.known.clear(); p.knownMap = p.c.map; }
      const out: Ent[] = [], seen = new Set<string>();
      const see = (e: Ent, s: string) => { seen.add(e.id); if (p.known.get(e.id) !== s) { p.known.set(e.id, s); out.push(e); } };
      for (const o of ents) if (o.map === p.c.map && Math.abs(o.e.x - p.c.x) <= VIEW && Math.abs(o.e.y - p.c.y) <= VIEW && (!o.owner || o.owner === p.id)) see(o.e, o.s);
      if (p.c.grave?.map === p.c.map) { const g = p.c.grave, e: Ent = { id: 'grave', k: 'g', x: g.x, y: g.y }; see(e, JSON.stringify(e)); }
      const gone: string[] = []; for (const id of p.known.keys()) if (!seen.has(id)) { gone.push(id); p.known.delete(id); }
      const ev = this.events.filter(v => v.map === p.c.map && rectDist(v.x, v.y, { x: p.c.x, y: p.c.y, w: 1, h: 1 }) <= VIEW).map(v => v.ev);
      p.send({ t: 'snap', tick: this.tick, map: p.c.map, reset: reset || undefined, ents: out, gone, ev });
      if (this.tick % 5 === 0) this.bossInfo(p);
    }
    this.events = [];
  }
}
