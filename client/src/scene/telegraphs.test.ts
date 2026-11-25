import type { BossView } from '@driftwake/shared';
import { expect, it } from 'vitest';
import { telegraphKey } from './telegraphs';

const attack = (state: BossView['state'], start: number, end: number): BossView => ({
  state,
  attack: 'boulder',
  tiles: [[1, 2]],
  centres: [[1, 2]],
  start,
  end,
});

it('keeps one key from wind-up through execution, by boss and landing tick', () => {
  expect(telegraphKey('7', attack('windup', 100, 105))).toBe('7:105');
  expect(telegraphKey('7', attack('execute', 105, 107))).toBe('7:105');
  expect(telegraphKey('7', attack('windup', 120, 125))).not.toBe('7:105');
  expect(telegraphKey('8', attack('windup', 100, 105))).not.toBe('7:105');
});

it('has no key when there is nothing to show', () => {
  expect(telegraphKey('7', { ...attack('windup', 1, 4), tiles: [] })).toBe('');
  expect(telegraphKey('7', attack('choose', 0, 0))).toBe('');
});
