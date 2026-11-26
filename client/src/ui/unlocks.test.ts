import { describe, expect, it } from 'vitest';
import { reachOf } from './unlocks';

const at = (...levels: number[]) => levels.map(level => ({ level, kind: 'node' as const, id: '', text: '' }));

describe('what a skill opens', () => {
  it('marks what the level reaches, and everything the next level to open anything opens', () => {
    expect(reachOf(at(1, 10, 10, 20), 10)).toEqual(['done', 'done', 'done', 'next']);
    expect(reachOf(at(1, 10, 10, 20), 5)).toEqual(['done', 'next', 'next', 'later']);
  });
  it('has nothing next once everything is open', () => {
    expect(reachOf(at(1, 50), 50)).toEqual(['done', 'done']);
  });
});
