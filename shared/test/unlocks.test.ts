import { expect, it } from 'vitest';
import { ITEMS, METHODS, NODES, RECIPES, SKILLS, type Skill, UNLOCKS } from '../src';

const listed = (skill: Skill, kind: string, id: string, level: number) =>
  UNLOCKS[skill].some(unlock => unlock.kind === kind && unlock.id === id && unlock.level === level);

it('every node, recipe and requirement shows up in the list of its skill, at its level', () => {
  for (const node of Object.values(NODES))
    if (node.skill) expect(listed(node.skill, 'node', node.id, node.level), node.id).toBe(true);
  for (const recipe of RECIPES)
    expect(listed(recipe.skill, 'recipe', recipe.id, recipe.level), recipe.id).toBe(true);
  for (const item of Object.values(ITEMS))
    for (const [skill, level] of Object.entries(item.req ?? {}))
      expect(listed(skill as Skill, 'gear', item.id, level), `${item.id} ${skill}`).toBe(true);
});
it('skills with glowing nodes list the level from which glowing gives more', () => {
  for (const skill of ['mining', 'woodcutting', 'fishing'] as const)
    expect(listed(skill, 'method', skill, METHODS.level), skill).toBe(true);
});
it('every skill has a list, by level', () => {
  for (const skill of SKILLS) {
    const levels = UNLOCKS[skill].map(unlock => unlock.level);
    expect(levels.length, skill).toBeGreaterThan(0);
    expect(levels, skill).toEqual([...levels].sort((a, b) => a - b));
  }
});
