import { BOAT_PARTS, ITEMS, MAPS, NODES, RECIPES, gatherChance, inReach, ticks } from '@magicka/shared';
import { bestTool, count, give, level, take } from './inventory';
import type { Player } from './types';
import type { World } from './world';
export function gather(w: World, p: Player, id: string) {
  const node = w.nodes.get(id); if (!node || node.map !== p.c.map) return w.stop(p);
  const d = NODES[node.type], lv = d.skill ? level(p, d.skill) : 1;
  if (node.depletedUntil > w.tick) return w.stop(p);
  if (lv < d.level) { w.info(p, `You need ${d.skill} level ${d.level} for that.`); return w.stop(p); }
  let tier = 0;
  if (d.tool) {
    tier = bestTool(p, d.tool);
    if (tier < d.tier - 1) { w.info(p, `You need a better ${d.tool} for that.`); return w.stop(p); }
  }
  if (p.c.inv.every(Boolean) && !(ITEMS[d.item].stack && count(p, d.item))) { w.info(p, 'Your inventory is full.'); return w.stop(p); }
  p.act = d.kind === 'rock' ? 'mine' : d.kind === 'tree' ? 'chop' : 'pick';
  if (p.nextAct > w.tick) return;
  if (p.nextAct < w.tick - 1) { p.nextAct = w.tick + 3; return; }
  p.nextAct = w.tick + 3;
  if (w.rnd() > gatherChance(lv, d.level, tier)) return;
  give(p, d.item, 1);
  if (d.skill) w.addXp(p, d.skill, d.xp);
  if (d.kind === 'rock' && d.id !== 'essence_rock' && w.rnd() < 0.04) give(p, `gem_${d.tier}`, 1);
  if (w.rnd() < d.deplete) { node.depletedUntil = w.tick + ticks(d.respawn); w.stop(p); }
}
export function craft(w: World, p: Player, a: { id: string; left: number }) {
  const r = RECIPES.find(r => r.id === a.id)!;
  const st = MAPS[p.c.map].stations.find(s => s.type === r.station)!;
  if (!inReach(p.c.x, p.c.y, { ...st, w: 1, h: 1 }, 2)) return w.stop(p);
  if (level(p, r.skill) < r.level) { w.info(p, `You need ${r.skill} level ${r.level}.`); return w.stop(p); }
  if (!r.in.every(([i, n]) => count(p, i) >= n)) { w.info(p, 'You are out of materials.'); return w.stop(p); }
  p.act = 'craft';
  if (p.nextAct > w.tick) return;
  if (p.nextAct < w.tick - 1) { p.nextAct = w.tick + 3; return; }
  p.nextAct = w.tick + 3;
  const before = p.c.inv.map(s => s && { ...s });
  for (const [i, n] of r.in) take(p, i, n);
  if (give(p, r.out, r.qty) < r.qty) { p.c.inv = before; w.info(p, 'Your inventory is full.'); return w.stop(p); }
  w.addXp(p, r.skill, r.xp);
  if (--a.left <= 0) w.stop(p);
}
export function buildBoat(w: World, p: Player) {
  let added = false;
  for (const b of BOAT_PARTS) {
    const have = p.c.boat[b.id] ?? 0, n = Math.min(b.qty - have, count(p, b.item));
    if (n > 0 && take(p, b.item, n)) { p.c.boat[b.id] = have + n; added = true; }
  }
  if (!added) return w.info(p, 'You have nothing the boat needs.');
  p.dirty = true;
  if (BOAT_PARTS.every(b => (p.c.boat[b.id] ?? 0) >= b.qty)) { p.c.boatDone = true; w.info(p, 'Your boat is finished. You can sail to the mainland.', 'level'); }
  w.save([p]);
}
