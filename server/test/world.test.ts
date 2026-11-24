import { beforeEach, describe, expect, it } from 'vitest';
import { BOAT_PARTS, MAPS, MONSTERS, RECIPES, SKILLS, bossMaxHp, decodeClient, maxHp, mulberry, xpForLevel, type ClientMsg, type MapId, type ServerMsg } from '@magicka/shared';
import { Auth } from '../src/auth';
import { hurtPlayer, rollLoot } from '../src/combat';
import { bossShare, resetBoss } from '../src/bosses';
import { Db } from '../src/db';
import { count, give } from '../src/inventory';
import type { Monster, Player, SavedChar } from '../src/types';
import { World } from '../src/world';
let w: World, saved: Map<number, string>, out: ServerMsg[];
const mk = (n = 1) => w.join(n, `P${n}`, null, m => { if (n === 1) out.push(m); });
const run = (n: number, f?: () => void) => { for (let i = 0; i < n; i++) { w.step(); f?.(); } };
const doIt = (p: Player, m: ClientMsg, n = 1) => { w.enqueue(p.id, m); run(n); };
const at = (p: Player, x: number, y: number, map: MapId = p.c.map) => { p.c.map = map; p.c.x = x; p.c.y = y; w.stop(p); };
const lv = (p: Player, n: number) => { for (const s of SKILLS) p.c.xp[s] = xpForLevel(n); p.c.hp = maxHp(n); };
const node = (type: string, map: MapId) => MAPS[map].nodes.find(n => n.type === type)!;
const st = (type: string, map: MapId = 'island') => MAPS[map].stations.find(s => s.type === type)!;
const atStation = (p: Player, type: string, map: MapId = 'island') => { const s = st(type, map); at(p, s.x, s.y + 1, map); };
const mini = () => [...w.monsters.values()].find(m => m.def.id === 'gnashclaw')!;
beforeEach(() => { saved = new Map(); out = []; w = new World({ saveMany: l => l.forEach(([a, c]) => saved.set(a, JSON.stringify(c))) }, mulberry(5), false, 1000); });

describe('skilling', () => {
  it('walks, mines, smelts and smiths a pickaxe', () => {
    const p = mk(); const n = node('rock_1', 'island');
    for (let i = 0; i < 400 && count(p, 'copper_ore') < 4; i++) { if (!p.action) w.enqueue(p.id, { t: 'gather', id: n.id }); run(1); }
    expect(count(p, 'copper_ore')).toBeGreaterThanOrEqual(4); expect(p.c.xp.mining).toBeGreaterThan(0);
    give(p, 'ash_log', 1); atStation(p, 'furnace'); doIt(p, { t: 'craft', id: 'copper_bar', qty: 2 }, 12); expect(count(p, 'copper_bar')).toBe(2);
    atStation(p, 'anvil'); doIt(p, { t: 'craft', id: 'copper_pickaxe', qty: 1 }, 8); expect(count(p, 'copper_pickaxe')).toBe(1); expect(count(p, 'copper_bar')).toBe(0);
  });
  it('no tier can be skipped: level and previous tool tier are both required', () => {
    const p = mk(); lv(p, 50);
    for (let t = 2; t <= 5; t++) for (const [kind, tools] of [['rock', ['worn_pickaxe', 'copper_pickaxe', 'iron_pickaxe', 'mithril_pickaxe', 'cobalt_pickaxe']], ['tree', ['worn_axe', 'copper_axe', 'iron_axe', 'mithril_axe', 'cobalt_axe']]] as const) {
      const n = node(`${kind}_${t}`, 'mainland');
      const attempt = (tool: string) => { p.c.inv.fill(null); give(p, tool, 1); w.nodes.get(n.id)!.depletedUntil = 0; at(p, n.x, n.y - 1, 'mainland'); p.c.hp = 1e6; p.c.grave = null; doIt(p, { t: 'gather', id: n.id }, 60); return p.c.inv.filter(Boolean).length > 1; };
      expect(attempt(tools[t - 2]), `${kind}${t} low`).toBe(false); expect(attempt(tools[t - 1]), `${kind}${t} ok`).toBe(true);
    }
  });
  it('refuses a low level', () => { const p = mk(); give(p, 'copper_pickaxe', 1); const n = node('rock_2', 'island'); at(p, n.x, n.y - 1); doIt(p, { t: 'gather', id: n.id }, 30); expect(count(p, 'iron_ore')).toBe(0); });
  it('every recipe conserves materials and respects range', () => {
    for (const r of RECIPES) {
      const p = mk(); lv(p, 50); p.c.inv.fill(null); for (const [i, q] of r.in) give(p, i, q); p.lastCombat = -999;
      at(p, 10, 30); doIt(p, { t: 'craft', id: r.id, qty: 1 }, 5); expect(count(p, r.out), r.id + ' range').toBe(0);
      atStation(p, r.station); doIt(p, { t: 'craft', id: r.id, qty: 5 }, 8); expect(count(p, r.out), r.id).toBe(r.qty); for (const [i] of r.in) expect(count(p, i)).toBe(0);
    }
  });
});
describe('inventory', () => {
  it('never creates or loses items under random operations', () => {
    const p = mk(), r = mulberry(9); lv(p, 50); atStation(p, 'bank');
    const ids = ['copper_arrow', 'iron_arrow', 'copper_sword', 'ash_bow', 'essence', 'copper_helm', 'berries'];
    for (const i of ids) give(p, i, 2);
    const tot = () => { const t: Record<string, number> = {}; const a = (s: { id: string; qty: number } | null | undefined) => { if (s) t[s.id] = (t[s.id] ?? 0) + s.qty; }; p.c.inv.forEach(a); p.c.bank.forEach(a); Object.values(p.c.equip).forEach(a); for (const d of w.drops.values()) a({ id: d.item, qty: d.qty }); return t; };
    const start = tot();
    for (let i = 0; i < 2000; i++) {
      const k = Math.floor(r() * 6), slot = Math.floor(r() * 24), id = ids[Math.floor(r() * ids.length)];
      const m: ClientMsg = k === 0 ? { t: 'equip', slot } : k === 1 ? { t: 'unequip', slot: (['weapon', 'ammo', 'head'] as const)[Math.floor(r() * 3)] } : k === 2 ? { t: 'bank', op: 'deposit', item: id, qty: 1 + Math.floor(r() * 3) } : k === 3 ? { t: 'bank', op: 'withdraw', item: id, qty: 1 + Math.floor(r() * 3) } : k === 4 ? { t: 'swap', a: slot, b: Math.floor(r() * 24) } : { t: 'depositAll' };
      doIt(p, m); if (i % 100 === 0) expect(tot()).toEqual(start);
    }
    expect(tot()).toEqual(start);
  });
});
describe('combat and death', () => {
  for (const [style, weapon, ammo] of [['melee', 'iron_sword', null], ['ranged', 'pine_bow', 'iron_arrow'], ['magic', 'pine_staff', 'essence']] as const) it(`${style} kills and loots`, () => {
    const p = mk(); lv(p, 15); p.c.equip.weapon = { id: weapon, qty: 1 }; if (ammo) p.c.equip.ammo = { id: ammo, qty: 500 };
    const m = [...w.monsters.values()].find(m => m.def.id === 'boar')!; at(p, m.x + 1, m.y); const xp = p.c.xp[style];
    for (let i = 0; i < 200 && !m.dead; i++) { if (!p.action) w.enqueue(p.id, { t: 'attack', id: m.id }); run(1); }
    expect(m.dead).toBe(true); expect(p.c.xp[style]).toBeGreaterThan(xp); if (ammo) expect(p.c.equip.ammo!.qty).toBeLessThan(500);
    const d = [...w.drops.values()].find(d => d.item === 'hide_1')!; doIt(p, { t: 'pickup', id: d.id }, 15); expect(count(p, 'hide_1')).toBe(1);
  });
  it('bows need arrows no better than the bow', () => { const p = mk(); lv(p, 50); p.c.equip.weapon = { id: 'ash_bow', qty: 1 }; give(p, 'iron_arrow', 5); const m = [...w.monsters.values()].find(m => m.def.id === 'boar')!; at(p, m.x + 1, m.y); doIt(p, { t: 'attack', id: m.id }, 6); expect(count(p, 'iron_arrow')).toBe(5); });
  it('death keeps gear, stores carried items for the owner only, forever, and survives a reload', () => {
    const p = mk(), q = mk(2); p.c.equip.weapon = { id: 'copper_sword', qty: 1 }; give(p, 'copper_ore', 3); at(p, 20, 44);
    hurtPlayer(w, p, 'x', 999, 'melee'); expect(p.c.equip.weapon!.id).toBe('copper_sword'); expect(p.c.inv.every(s => !s)).toBe(true); expect(p.c.grave).toMatchObject({ x: 20, y: 44 });
    give(p, 'ash_log', 1); at(p, 22, 44); hurtPlayer(w, p, 'x', 999, 'melee'); expect(p.c.grave!.items.find(s => s.id === 'ash_log')).toBeTruthy(); expect(p.c.grave!.x).toBe(22);
    at(q, 22, 44); doIt(q, { t: 'grave' }, 3); expect(p.c.grave).toBeTruthy(); run(3000); expect(p.c.grave!.items.length).toBeGreaterThan(3);
    const w2 = new World({ saveMany() {} }, mulberry(1)); const p2 = w2.join(1, 'P1', JSON.parse(saved.get(1)!) as SavedChar, () => {});
    expect(p2.c.grave).toEqual(p.c.grave);
    const r = st('reaper'); p2.c.x = r.x; p2.c.y = r.y + 1; w2.enqueue(p2.id, { t: 'claim' }); w2.step(); w2.enqueue(p2.id, { t: 'claim' }); w2.step();
    expect(p2.c.grave).toBeNull(); expect(count(p2, 'copper_ore')).toBe(3); expect(count(p2, 'worn_axe')).toBe(1);
  });
  it('claims only what fits', () => { const p = mk(); p.c.inv.fill(null); give(p, 'ash_log', 24); hurtPlayer(w, p, 'x', 999, 'melee'); give(p, 'berries', 20); atStation(p, 'reaper'); doIt(p, { t: 'claim' }); expect(count(p, 'ash_log')).toBe(4); expect(p.c.grave!.items).toEqual([{ id: 'ash_log', qty: 20 }]); });
  it('disconnecting in combat lingers, then saves and leaves', () => { const p = mk(); at(p, 20, 44); const send = p.send!; hurtPlayer(w, p, 'x', 1, 'melee'); w.leave(p, send); run(10); expect(w.players.has(p.id)).toBe(true); run(60); expect(w.players.has(p.id)).toBe(false); expect(saved.has(1)).toBe(true); });
  it('a second login takes over without duplicating', () => { const p = mk(); const old = p.send!; const p2 = w.join(1, 'P1', null, () => {}); expect(p2).toBe(p); w.leave(p, old); run(60); expect(w.players.has(p.id)).toBe(true); });
});
describe('bosses', () => {
  const sit = (p: Player, m: Monster) => { at(p, m.x - 1, m.y, m.map); p.c.hp = 1e6; m.active.set(p.id, w.tick); };
  it('only cycles choose, windup, execute; a chosen attack never changes; melee only in reach', () => {
    const p = mk(), m = mini(); let prev = '', prevAtk = '', prevTiles = '', chosen = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      const close = Math.floor(i / 150) % 2 === 0; at(p, close ? m.x - 1 : m.x - 6, m.y, m.map); p.c.hp = 1e6; m.active.set(p.id, w.tick); w.step();
      const b = m.boss!;
      if (prev === 'windup' && b.st === 'windup') { expect(b.atk!.id).toBe(prevAtk); expect(JSON.stringify(b.tiles)).toBe(prevTiles); }
      if (prev && prev !== b.st) expect(`${prev}>${b.st}`).toMatch(/^(choose>windup|windup>execute|execute>choose)$/);
      if (prev === 'choose' && b.st === 'windup') { chosen.add(b.atk!.id); if (!close) expect(b.atk!.id).not.toBe('melee'); }
      prev = b.st; prevAtk = b.atk?.id ?? ''; prevTiles = JSON.stringify(b.tiles);
    }
    expect([...chosen].sort()).toEqual(['boulder', 'melee', 'vines']);
  });
  it('telegraphed attacks can be dodged and hit if ignored; vines root', () => {
    const p = mk(), m = mini(); let dodged = 0, hit = 0, rooted = 0;
    for (let i = 0; i < 800; i++) {
      const b = m.boss!, dodge = i < 400; if (b.st === 'windup' && b.end === w.tick + 1 && dodge && b.atk!.id !== 'melee') at(p, m.x - 8, m.y + 3, m.map); else at(p, m.x - 6, m.y, m.map);
      p.c.hp = 1e6; m.active.set(p.id, w.tick); w.step();
      if (b.st === 'execute' && b.start === w.tick) { if (p.c.hp < 1e6) { expect(dodge).toBe(false); hit++; } else dodged++; if (p.rootedUntil > w.tick) rooted++; }
    }
    expect(dodged).toBeGreaterThan(10); expect(hit).toBeGreaterThan(10); expect(rooted).toBeGreaterThan(0);
  });
  it('health scales up and down keeping its percentage', () => {
    w.spawnWorldBoss(); const m = w.worldBoss(), ps = [1, 2, 3, 4].map(mk); for (const p of ps) sit(p, m); w.step();
    expect(m.mhp).toBe(bossMaxHp(900, 4)); m.hp = m.mhp * 0.4; at(ps[2], 48, 77); at(ps[3], 48, 77); m.active.delete('p3'); m.active.delete('p4'); sit(ps[0], m); sit(ps[1], m); w.step();
    expect(m.mhp).toBe(bossMaxHp(900, 2)); expect(m.hp / m.mhp).toBeCloseTo(0.4);
  });
  it('inactive fighters drop off after 20 s', () => { w.spawnWorldBoss(); const m = w.worldBoss(); const a = mk(), b = mk(2); m.active.set(a.id, w.tick); m.active.set(b.id, w.tick); at(a, 48, 77, 'mainland'); at(b, 48, 77, 'mainland'); run(1); expect(m.mhp).toBe(bossMaxHp(900, 2)); for (let i = 0; i < 40; i++) { m.active.set(a.id, w.tick); w.step(); } expect(m.mhp).toBe(900); });
  it('loot goes to contributors above 2%, private 3 minutes, then public', () => {
    const p = mk(), q = mk(2), m = mini(); lv(p, 50); p.c.equip.weapon = { id: 'rootcleaver', qty: 1 }; m.dmg.set('p2', 0.01); m.dmg.set(p.id, 0.5); expect(bossShare(m)).toEqual([p.id]);
    for (let i = 0; i < 200 && !m.dead; i++) { if (i % 1 === 0) at(p, m.x - 1, m.y); p.action = { type: 'attack', id: m.id }; p.c.hp = 1e6; w.step(); }
    expect(m.dead).toBe(true); const d = [...w.drops.values()].find(d => d.item === 'rudder')!; expect(d.owner).toBe(p.id); expect([...w.drops.values()].every(x => x.owner === p.id)).toBe(true);
    at(q, d.x, d.y); doIt(q, { t: 'pickup', id: d.id }, 2); expect(count(q, 'rudder')).toBe(0);
    run(301); at(q, d.x, d.y); q.c.hp = 1e6; doIt(q, { t: 'pickup', id: d.id }, 2); expect(count(q, 'rudder')).toBe(1);
  });
  it('uniques drop near their stated rate', () => { const r = mulberry(3); let n = 0; for (let i = 0; i < 40000; i++) n += rollLoot(r, MONSTERS.colossus.loot).filter(l => l[2]).length; expect(n / 40000).toBeGreaterThan(0.065); expect(n / 40000).toBeLessThan(0.085); });
  it('world boss spawns on schedule and resets when abandoned', () => { run(1000); const m = w.worldBoss(); expect(m.dead).toBe(false); m.dmg.set('p1', 0.5); m.hp = 10; run(2); expect(m.hp).toBe(900); resetBoss(m); });
});
describe('boat and abuse', () => {
  it('builds in stages and sails both ways', () => {
    const p = mk(); atStation(p, 'dock'); doIt(p, { t: 'boat', op: 'sail' }); expect(p.c.map).toBe('island');
    for (const b of BOAT_PARTS) { p.c.inv.fill(null); give(p, b.item, b.qty); doIt(p, { t: 'boat', op: 'build' }); expect(count(p, b.item)).toBe(0); }
    expect(p.c.boatDone).toBe(true); doIt(p, { t: 'boat', op: 'sail' }); expect(p.c.map).toBe('mainland'); atStation(p, 'dock', 'mainland'); doIt(p, { t: 'boat', op: 'sail' }); expect(p.c.map).toBe('island');
  });
  it('ignores remote interactions and caps speed at two tiles a tick', () => {
    const p = mk(); p.c.bank = [{ id: 'essence', qty: 9 }]; at(p, 20, 44); doIt(p, { t: 'bank', op: 'withdraw', item: 'essence', qty: 9 }); expect(count(p, 'essence')).toBe(0); doIt(p, { t: 'claim' });
    const x = p.c.x; for (let i = 0; i < 10; i++) w.enqueue(p.id, { t: 'move', x: 40, y: 44 }); run(1); expect(p.c.x - x).toBeLessThanOrEqual(2);
    give(p, 'iron_sword', 1); doIt(p, { t: 'equip', slot: p.c.inv.findIndex(s => s?.id === 'iron_sword') }); expect(p.c.equip.weapon).toBeUndefined();
    doIt(p, { t: 'chat', text: '/give gem_5 5' }); expect(count(p, 'gem_5')).toBe(0); doIt(p, { t: 'attack', id: 'nope' }); doIt(p, { t: 'bank', op: 'withdraw', item: '__proto__', qty: 1 });
  });
});
describe('appearance', () => {
  it('saves a chosen look, shows it to others, and rejects invalid ones', () => {
    const p = mk(), seen: ServerMsg[] = []; w.join(2, 'P2', null, m => seen.push(m)); run(1);
    doIt(p, { t: 'look', cut: 2, color: 7 });
    expect(JSON.parse(saved.get(1)!).look).toEqual({ cut: 2, color: 7 });
    const ent = seen.flatMap(m => (m.t === 'snap' ? m.ents : [])).filter(e => e.id === p.id).at(-1)!; expect(ent.look).toEqual({ cut: 2, color: 7 });
    for (const bad of ['{"t":"look","cut":4,"color":0}', '{"t":"look","cut":0,"color":8}', '{"t":"look","cut":-1,"color":0}', '{"t":"look","cut":0.5,"color":0}', '{"t":"look","cut":0}']) expect(decodeClient(bad)).toBeNull();
  });
  it('characters saved before looks existed still load', () => { const old = JSON.parse(JSON.stringify(mk().c)); delete old.look; const w2 = new World({ saveMany() {} }); const p = w2.join(9, 'Old', old, m => out.push(m)); w2.step(); expect(p.c.look).toBeNull(); expect(out.some(m => m.t === 'self' && m.s.name === 'Old' && m.s.look.cut >= 0)).toBe(true); });
});
describe('accounts', () => {
  it('registers, logs in, resumes, revokes and persists', async () => {
    const db = new Db(':memory:'), a = new Auth(db); const r = await a.register('Tester', 'a-long-phrase'); if (typeof r === 'string') throw new Error(r);
    expect(await a.register('tester', 'another-phrase')).toBe('That name is taken.'); expect(await a.login('Tester', 'wrong-phrase')).toBe('Wrong name or password.'); expect(await a.login('nobody', 'wrong-phrase')).toBe('Wrong name or password.');
    expect(typeof a.resume(r.token)).toBe('object'); a.revoke(r.token); expect(a.resume(r.token)).toBe('Session expired.');
    const p = mk(); db.saveMany([[r.account, p.c]]); expect(db.load(r.account)).toEqual(p.c); db.close();
  });
});

describe('balance', () => {
  // A level 8 player in copper with six rations who steps off marked ground.
  const solo = (seed: number, dodge: boolean) => {
    w = new World({ saveMany() {} }, mulberry(seed)); const p = mk(50 + seed), m = mini(); lv(p, 8);
    p.c.equip = { weapon: { id: 'copper_sword', qty: 1 }, body: { id: 'copper_plate', qty: 1 }, legs: { id: 'copper_greaves', qty: 1 }, head: { id: 'copper_helm', qty: 1 } }; give(p, 'ration', 6); at(p, m.x - 1, m.y);
    for (let i = 0; i < 900; i++) {
      const b = m.boss!, hot = b.st === 'windup' && b.tiles.some(t => t[0] === p.c.x && t[1] === p.c.y), food = p.c.inv.findIndex(s => s?.id === 'ration');
      if (p.c.hp < 20 && food >= 0) w.enqueue(p.id, { t: 'eat', slot: food });
      if (dodge && hot) w.enqueue(p.id, { t: 'move', x: p.c.x - 3, y: p.c.y }); else if (!(dodge && b.st === 'windup' && b.atk!.id !== 'melee' && b.end > w.tick + 1 && p.action === null) && p.action?.type !== 'attack' && !(dodge && b.st === 'windup' && b.atk!.id !== 'melee')) w.enqueue(p.id, { t: 'attack', id: m.id });
      w.step(); if (m.dead) return true; if (p.c.grave) return false;
    }
    return false;
  };
  it('the mini boss is soloable in tier 1 gear by dodging, and dodging matters', () => {
    let a = 0, b = 0; for (let s = 1; s <= 30; s++) { if (solo(s, true)) a++; if (solo(s, false)) b++; }
    process.stdout.write(`\nmini boss solo wins of 30: dodging ${a}, standing still ${b}\n`); expect(a).toBeGreaterThanOrEqual(24); expect(a).toBeGreaterThan(b);
  });
});
