import { describe, expect, it } from 'vitest';
import { formatChance, logNote } from './collection';

describe('collection log notes', () => {
  it('shows the chance of each missing drop', () => {
    expect(formatChance(1 / 50)).toBe('1 in 50');
    expect(formatChance(0.3)).toBe('1 in 3');
    expect(logNote(0, 1 / 100, false)).toBe('Not found yet · 1 in 100');
  });

  it('shows how often a drop was found', () => {
    expect(logNote(1, 1 / 50, false)).toBe('Found 1 time');
    expect(logNote(2, 1 / 50, false)).toBe('Found 2 times');
    expect(logNote(1, undefined, true)).toBe('Found');
  });
});
