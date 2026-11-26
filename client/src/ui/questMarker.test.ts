import { QUESTS, type Quest } from '@driftwake/shared';
import { describe, expect, it } from 'vitest';
import { pullInside, questPlace } from './questMarker';

const stranded = QUESTS.find(quest => quest.id === 'stranded')!;
const far = [0, 0] as [number, number];

describe('questPlace', () => {
  it('marks nothing before a quest is begun', () => {
    expect(questPlace({}, 'island', far)).toBeUndefined();
  });

  it('marks the place of the first step not yet done', () => {
    expect(questPlace({ stranded: 0 }, 'island', far)).toBe(stranded.steps[0].place);
    expect(questPlace({ stranded: 3 }, 'island', far)).toBe(stranded.steps[3].place);
  });

  it('marks nothing once the quest is completed', () => {
    expect(questPlace({ stranded: stranded.steps.length }, 'island', far)).toBeUndefined();
  });

  it('hides once the player is there', () => {
    const { x, y, r } = stranded.steps[0].place;
    expect(questPlace({ stranded: 0 }, 'island', [x, y])).toBeUndefined();
    expect(questPlace({ stranded: 0 }, 'island', [x + r, y])).toBeUndefined();
    expect(questPlace({ stranded: 0 }, 'island', [x + r + 1, y])).toBeDefined();
  });

  it('marks nothing on another map', () => {
    expect(questPlace({ stranded: 0 }, 'mainland', far)).toBeUndefined();
  });

  it('follows the first quest begun and not completed', () => {
    const place = (x: number) => ({ map: 'island' as const, x, y: 0, r: 1 });
    const quests = [
      { id: 'a', steps: [{ place: place(10) }] },
      { id: 'b', steps: [{ place: place(20) }, { place: place(30) }] },
    ] as Quest[];
    expect(questPlace({ a: 1, b: 1 }, 'island', far, quests)?.x).toBe(30);
    expect(questPlace({ a: 0, b: 1 }, 'island', far, quests)?.x).toBe(10);
  });
});

describe('pullInside', () => {
  it('keeps a place within range where it is', () => {
    expect(pullInside([12, 8], [10, 10], 5)).toEqual({ at: [12, 8], inside: true });
  });

  it('brings a place out of range to the edge, in its direction', () => {
    expect(pullInside([30, 10], [10, 10], 5)).toEqual({ at: [15, 10], inside: false });
    expect(pullInside([0, 30], [10, 10], 5)).toEqual({ at: [7.5, 15], inside: false });
  });
});
