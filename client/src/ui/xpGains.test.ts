import { describe, expect, it } from 'vitest';
import { addGain, type Presence, SHOWN_MS, shouldForget, withoutExpired, type XpGain } from './xpGains';

describe('XP gains', () => {
  it('adds gains in the same skill together on one line', () => {
    let gains: XpGain[] = [];
    gains = addGain(gains, 'mining', 25, 0);
    gains = addGain(gains, 'mining', 5, 100);
    expect(gains).toEqual([{ skill: 'mining', amount: 30, at: 100 }]);
  });

  it('gives each skill a line of its own, in the order they came', () => {
    let gains: XpGain[] = [];
    gains = addGain(gains, 'melee', 4, 0);
    gains = addGain(gains, 'vitality', 1, 0);
    gains = addGain(gains, 'melee', 4, 50);
    expect(gains.map(gain => [gain.skill, gain.amount])).toEqual([
      ['melee', 8],
      ['vitality', 1],
    ]);
  });

  it('does not change the list it was given', () => {
    const gains = addGain([], 'magic', 1, 0);
    addGain(gains, 'magic', 1, 1);
    expect(gains[0].amount).toBe(1);
  });

  it('drops a line when nothing has come in its skill for a while', () => {
    let gains: XpGain[] = [];
    gains = addGain(gains, 'melee', 4, 0);
    gains = addGain(gains, 'defence', 1, 1000);
    const later = withoutExpired(gains, SHOWN_MS + 1);
    expect(later.map(gain => gain.skill)).toEqual(['defence']);
  });

  it('keeps a line alive for as long as gains keep coming', () => {
    let gains: XpGain[] = [];
    for (let now = 0; now <= 5000; now += 1000) gains = addGain(gains, 'mining', 1, now);
    expect(withoutExpired(gains, 5000 + SHOWN_MS - 1)).toHaveLength(1);
    expect(gains[0].amount).toBe(6);
  });
});

describe('forgetting gains', () => {
  const here: Presence = { me: 'p1', map: 'island', tile: [10, 10], alive: true };

  it('keeps them while walking', () => {
    expect(shouldForget(here, { ...here, tile: [13, 10] })).toBe(false);
    expect(shouldForget(null, here)).toBe(false);
  });

  it('forgets them after logging out, a change of map, dying or a jump', () => {
    expect(shouldForget(here, null)).toBe(true);
    expect(shouldForget(here, { ...here, map: 'mine' })).toBe(true);
    expect(shouldForget(here, { ...here, alive: false })).toBe(true);
    expect(shouldForget(here, { ...here, tile: [40, 10] })).toBe(true);
    expect(shouldForget(here, { ...here, me: 'p2' })).toBe(true);
  });
});
