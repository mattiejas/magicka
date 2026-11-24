import { describe, expect, it } from 'vitest';
import { BOAT_PARTS, ITEMS, MAPS, MONSTERS, NODES, RECIPES, gatherChance, hitChance, levelForXp, styleModifier, xpForLevel } from '../src';
describe('formulas', () => {
  it('xp curve round-trips and caps at 50', () => { for (let n = 1; n <= 50; n++) { expect(levelForXp(xpForLevel(n))).toBe(n); if (n > 1) expect(levelForXp(xpForLevel(n) - 1)).toBe(n - 1); } expect(levelForXp(1e9)).toBe(50); });
  it('style triangle', () => { expect(styleModifier('melee', 'ranged')).toBe(1.2); expect(styleModifier('ranged', 'magic')).toBe(1.2); expect(styleModifier('magic', 'melee')).toBe(1.2); expect(styleModifier('ranged', 'melee')).toBe(0.8); expect(hitChance(1, 0, 99, 99, 0.8)).toBeGreaterThanOrEqual(0.1); expect(gatherChance(50, 1, 5)).toBeLessThan(1); });
});
describe('content graph', () => {
  it('only references real items', () => { for (const r of RECIPES) for (const [i] of [...r.in, [r.out]] as [string][]) expect(ITEMS[i], i).toBeTruthy(); for (const m of Object.values(MONSTERS)) for (const l of [...(m.loot.always ?? []), ...(m.loot.common ?? []), ...(m.loot.rare ?? []), ...(m.loot.unique ?? [])]) expect(ITEMS[l[0]], l[0]).toBeTruthy(); for (const n of Object.values(NODES)) expect(ITEMS[n.item]).toBeTruthy(); });
  it('every item is obtainable from nodes, monsters and recipes', () => {
    const have = new Set(['worn_pickaxe', 'worn_axe', 'worn_sword']);
    for (const m of Object.values(MAPS)) { for (const n of m.nodes) have.add(NODES[n.type].item); for (const s of m.spawns) { const l = MONSTERS[s.type].loot; for (const e of [...(l.always ?? []), ...(l.common ?? []), ...(l.rare ?? []), ...(l.unique ?? [])]) have.add(e[0]); } }
    for (let changed = true; changed;) { changed = false; for (const r of RECIPES) if (!have.has(r.out) && r.in.every(([i]) => have.has(i))) { have.add(r.out); changed = true; } }
    expect(Object.keys(ITEMS).filter(i => !have.has(i))).toEqual([]);
  });
  it('the boat can be built from the island alone', () => { const m = MAPS.island; const types = new Set(m.nodes.map(n => n.type)); expect(types.has('tree_1') && types.has('rock_1') && types.has('plant_1')).toBe(true); expect(m.spawns.some(s => MONSTERS[s.type].loot.always?.some(l => l[0] === 'rudder'))).toBe(true); expect(BOAT_PARTS).toHaveLength(4); });
});
describe('maps', () => {
  for (const m of Object.values(MAPS)) it(`${m.id}: resources match the tiers it should have`, () => {
    const counts: Record<string, number> = {}; for (const o of [...m.nodes, ...m.spawns]) counts[o.type] = (counts[o.type] ?? 0) + 1;
    if (m.id === 'island') { expect(counts.rock_2).toBeLessThanOrEqual(2); expect(counts.tree_2).toBeLessThanOrEqual(2); expect(m.nodes.every(n => NODES[n.type].tier <= 2)).toBe(true); }
    else for (let t = 1; t <= 5; t++) for (const k of ['rock', 'tree', 'plant']) expect(counts[`${k}_${t}`], `${k}_${t}`).toBeGreaterThan(2);
  });
});
