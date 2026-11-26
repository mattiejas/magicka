import { describe, expect, it } from 'vitest';
import { clampShare, GROW_MS, HOLD_MS, SHRINK_MS, transitionsTo } from './damageBar';

describe('damage on health bars', () => {
  it('drops the fill to the new health at once when hit', () => {
    expect(transitionsTo('width', 1, 0.6).fill).toBe('none');
  });

  it('holds the red for 400 ms after a hit, then shrinks it over 500 ms, easing out', () => {
    expect(HOLD_MS).toBe(400);
    expect(SHRINK_MS).toBe(500);
    expect(transitionsTo('width', 1, 0.6).trail).toBe('width 500ms ease-out 400ms');
  });

  it('animates the height of a bar that stands up', () => {
    expect(transitionsTo('height', 0.5, 0.2).trail).toBe('height 500ms ease-out 400ms');
  });

  it('shows no red when healed: the trail grows with the fill', () => {
    const { fill, trail } = transitionsTo('width', 0.4, 0.9);
    expect(fill).toBe(`width ${GROW_MS}ms`);
    expect(trail).toBe(fill);
  });

  it('keeps the share between empty and full', () => {
    expect(clampShare(-0.2)).toBe(0);
    expect(clampShare(1.5)).toBe(1);
    expect(clampShare(Number.NaN)).toBe(0);
    expect(clampShare(0.25)).toBe(0.25);
  });
});
