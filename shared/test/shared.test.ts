import { describe, expect, it } from 'vitest';
import {
  BOAT_PARTS,
  ECONOMY,
  gatherChance,
  hitChance,
  ITEMS,
  type LootTable,
  levelForXp,
  MAPS,
  MONSTERS,
  NODES,
  RECIPES,
  SKILLS,
  styleModifier,
  xpForLevel,
} from '../src';

describe('formulas', () => {
  it('xp curve round-trips and caps at 50', () => {
    for (let n = 1; n <= 50; n++) {
      expect(levelForXp(xpForLevel(n))).toBe(n);
      if (n > 1) expect(levelForXp(xpForLevel(n) - 1)).toBe(n - 1);
    }
    expect(levelForXp(1e9)).toBe(50);
  });
  it('style triangle', () => {
    expect(styleModifier('melee', 'ranged')).toBe(1.2);
    expect(styleModifier('ranged', 'magic')).toBe(1.2);
    expect(styleModifier('magic', 'melee')).toBe(1.2);
    expect(styleModifier('ranged', 'melee')).toBe(0.8);
    expect(hitChance(1, 0, 99, 99, 0.8)).toBeGreaterThanOrEqual(0.1);
    expect(gatherChance(50, 1, 5)).toBeLessThan(1);
  });
});
const lootItems = ({ always = [], common = [], rare = [], unique = [] }: LootTable): string[] =>
  [...always, ...common, ...rare, ...unique].map(([item]) => item);

describe('content graph', () => {
  it('only references real items', () => {
    for (const r of RECIPES)
      for (const [i] of [...r.in, [r.out]] as [string][]) expect(ITEMS[i], i).toBeTruthy();
    for (const m of Object.values(MONSTERS))
      for (const l of [
        ...(m.loot.always ?? []),
        ...(m.loot.common ?? []),
        ...(m.loot.rare ?? []),
        ...(m.loot.unique ?? []),
      ])
        expect(ITEMS[l[0]], l[0]).toBeTruthy();
    for (const n of Object.values(NODES)) expect(ITEMS[n.item]).toBeTruthy();
  });
  it('every item is obtainable from nodes, monsters and recipes', () => {
    const maps = Object.values(MAPS);
    const gathered = maps.flatMap(map => map.nodes.map(node => NODES[node.type].item));
    const looted = maps.flatMap(map => map.spawns.flatMap(spawn => lootItems(MONSTERS[spawn.type].loot)));
    const capes = SKILLS.map(skill => `cape_${skill}`);
    const have = new Set(['genie_lamp', ...ECONOMY.shopStock, ...capes, ...gathered, ...looted]);
    const craftable = () => RECIPES.filter(r => !have.has(r.out) && r.in.every(([item]) => have.has(item)));
    for (let next = craftable(); next.length; next = craftable())
      for (const recipe of next) have.add(recipe.out);
    expect(Object.keys(ITEMS).filter(i => !have.has(i))).toEqual([]);
  });
  it('the boat can be built from the island alone', () => {
    const m = MAPS.island;
    const types = new Set(m.nodes.map(n => n.type));
    expect(types.has('tree_1') && types.has('rock_1') && types.has('plant_1')).toBe(true);
    expect(m.spawns.some(s => MONSTERS[s.type].loot.always?.some(l => l[0] === 'ships_wheel'))).toBe(true);
    expect(BOAT_PARTS).toHaveLength(4);
  });
});
describe('maps', () => {
  const countTypes = ({ nodes, spawns }: (typeof MAPS)['island']) => {
    const counts: Record<string, number> = {};
    for (const { type } of [...nodes, ...spawns]) counts[type] = (counts[type] ?? 0) + 1;
    return counts;
  };
  it('the island has tier 1 resources and a taste of tier 2', () => {
    const counts = countTypes(MAPS.island);
    expect(counts.rock_2).toBeLessThanOrEqual(2);
    expect(counts.tree_2).toBeLessThanOrEqual(2);
    expect(MAPS.island.nodes.every(node => NODES[node.type].tier <= 2)).toBe(true);
  });
  it('the mainland has resources of every tier', () => {
    const counts = countTypes(MAPS.mainland);
    const wanted = ['rock', 'tree', 'plant'].flatMap(kind => [1, 2, 3, 4, 5].map(tier => `${kind}_${tier}`));
    for (const type of wanted) expect(counts[type], type).toBeGreaterThan(2);
  });
});
