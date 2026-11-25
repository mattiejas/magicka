import { describe, expect, it } from 'vitest';
import { fittingScale, NEEDED_HEIGHT, NEEDED_WIDTH } from './scale';

describe('fittingScale', () => {
  it('keeps the chosen scale when the window has room for it', () => {
    expect(fittingScale(1.5, 1920, 1080)).toBe(1.5);
    expect(fittingScale(0.75, 1920, 1080)).toBe(0.75);
  });

  it('fits 100% in a 1280 by 720 window', () => {
    expect(fittingScale(1.5, 1280, 720)).toBe(1);
  });

  it('steps down to the largest scale that fits', () => {
    expect(fittingScale(1.5, NEEDED_WIDTH * 1.3, NEEDED_HEIGHT * 1.3)).toBe(1.25);
    expect(fittingScale(1.5, NEEDED_WIDTH * 2, NEEDED_HEIGHT * 1.1)).toBe(1);
  });

  it('never goes below the smallest scale', () => {
    expect(fittingScale(1, 320, 240)).toBe(0.75);
  });
});
