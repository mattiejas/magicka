import { describe, expect, it } from 'vitest';
import { addLevelUp, LEVEL_SHOWN_MS, type LevelUps, levelsShown } from './levelUps';

const always = () => true;

describe('levels above heads', () => {
  it('shows a level for a few seconds from when it was reached', () => {
    const levelUps = addLevelUp(new Map(), 'a', { skill: 'mining', level: 10, at: 1000 });
    expect(levelsShown(levelUps, 1000 + LEVEL_SHOWN_MS - 1, always).get('a')).toHaveLength(1);
    expect(levelsShown(levelUps, 1000 + LEVEL_SHOWN_MS, always).size).toBe(0);
  });

  it('shows one line per skill, the newest level replacing the older', () => {
    let levelUps: LevelUps = new Map();
    levelUps = addLevelUp(levelUps, 'a', { skill: 'melee', level: 5, at: 0 });
    levelUps = addLevelUp(levelUps, 'a', { skill: 'vitality', level: 4, at: 0 });
    levelUps = addLevelUp(levelUps, 'a', { skill: 'melee', level: 6, at: 3000 });
    expect(levelsShown(levelUps, 3500, always).get('a')).toEqual([
      { skill: 'vitality', level: 4, at: 0 },
      { skill: 'melee', level: 6, at: 3000 },
    ]);
  });

  it('keeps players apart, and hides those it may not show', () => {
    let levelUps: LevelUps = new Map();
    levelUps = addLevelUp(levelUps, 'a', { skill: 'mining', level: 2, at: 0 });
    levelUps = addLevelUp(levelUps, 'b', { skill: 'mining', level: 3, at: 0 });
    expect([...levelsShown(levelUps, 0, player => player === 'b').keys()]).toEqual(['b']);
  });
});
