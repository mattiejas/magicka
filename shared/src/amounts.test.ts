import { describe, expect, it } from 'vitest';
import { amountOf } from './amounts';

describe('amountOf', () => {
  it('adds an s to a regular name for more than one', () => {
    expect(amountOf('ration', 1)).toBe('1 trail ration');
    expect(amountOf('ration', 5)).toBe('5 trail rations');
  });

  it('keeps a name that is already plural', () => {
    expect(amountOf('coin', 1)).toBe('1 coin');
    expect(amountOf('coin', 300)).toBe('300 coins');
    expect(amountOf('copper_greaves', 2)).toBe('2 copper greaves');
  });

  it('uses the plural the item names', () => {
    expect(amountOf('fibre_1', 5)).toBe('5 flax');
    expect(amountOf('raw_trout', 3)).toBe('3 raw trout');
  });

  it('groups thousands', () => {
    expect(amountOf('coin', 12000)).toBe('12,000 coins');
  });
});
