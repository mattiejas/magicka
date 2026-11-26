import { describe, expect, it } from 'vitest';
import { pileName, timerFor } from './dropTimer';

// A tick is 0.6 seconds, so 100 ticks are a minute.
const NOW = 1000;

describe('who may take an item on the ground', () => {
  it('shows a closed eye and no timer while the pile is private', () => {
    expect(timerFor(false, NOW + 500, 0, NOW)).toEqual({
      icon: 'closedEye',
      meaning: 'private',
      time: '',
      hurry: false,
    });
  });

  it('shows a closed eye and the time until it turns public', () => {
    expect(timerFor(false, NOW + 500, NOW + 140, NOW)).toMatchObject({
      icon: 'closedEye',
      meaning: 'public in 1:24',
      time: '1:24',
    });
  });

  it('shows an open eye and the time until it is gone once public', () => {
    expect(timerFor(false, NOW + 75, NOW - 1, NOW)).toMatchObject({
      icon: 'openEye',
      meaning: 'public, gone in 0:45',
      time: '0:45',
    });
  });

  it("shows the reaper's scythe for the owner's unique", () => {
    expect(timerFor(true, NOW + 217, 0, NOW)).toMatchObject({
      icon: 'scythe',
      meaning: 'to the reaper in 2:11',
      time: '2:11',
    });
  });

  it('hurries the timer in the last fifteen seconds', () => {
    expect(timerFor(false, NOW + 25, NOW - 1, NOW).hurry).toBe(true);
    expect(timerFor(false, NOW + 27, NOW - 1, NOW).hurry).toBe(false);
    expect(timerFor(false, NOW + 500, NOW + 25, NOW).hurry).toBe(true);
  });

  it('never counts below zero', () => {
    expect(timerFor(false, NOW - 10, NOW - 20, NOW).time).toBe('0:00');
  });
});

describe('the amount of a pile', () => {
  it('follows the name as ×N', () => expect(pileName('Coins', 10)).toBe('Coins ×10'));
  it('keeps the thousands separator', () => expect(pileName('Coins', 1250)).toBe('Coins ×1,250'));
  it('is left out for one', () => expect(pileName('Bronze sword', 1)).toBe('Bronze sword'));
});
