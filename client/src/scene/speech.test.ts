import { describe, expect, it } from 'vitest';
import { SPOKEN_MS, type Speech, type Spoken, say, stillShown } from './speech';

const line = (text: string, at = 0): Spoken => ({ text, at, map: 'island' });
const always = () => true;

describe('speech above heads', () => {
  it('keeps only the newest line of each speaker', () => {
    let speech: Speech = new Map();
    speech = say(speech, 'a', line('hello'));
    speech = say(speech, 'b', line('hi'));
    speech = say(speech, 'a', line('bye', 10));
    expect([...speech].map(([speaker, spoken]) => [speaker, spoken.text])).toEqual([
      ['a', 'bye'],
      ['b', 'hi'],
    ]);
  });

  it('shows a line for five seconds from when it was said', () => {
    const speech = say(new Map(), 'a', line('hello', 1000));
    expect(stillShown(speech, 1000 + SPOKEN_MS - 1, always).size).toBe(1);
    expect(stillShown(speech, 1000 + SPOKEN_MS, always).size).toBe(0);
  });

  it('restarts the time when the speaker says something new', () => {
    let speech = say(new Map(), 'a', line('hello', 0));
    speech = say(speech, 'a', line('again', 4000));
    expect(stillShown(speech, 6000, always).get('a')?.text).toBe('again');
  });

  it('drops the lines that may not be shown and keeps the rest', () => {
    let speech = say(new Map(), 'a', line('hello'));
    speech = say(speech, 'b', line('hi'));
    expect([...stillShown(speech, 0, speaker => speaker !== 'a').keys()]).toEqual(['b']);
  });

  it('does not change the lines it was given', () => {
    const speech = say(new Map(), 'a', line('hello'));
    say(speech, 'a', line('bye'));
    stillShown(speech, SPOKEN_MS, always);
    expect(speech.get('a')?.text).toBe('hello');
  });
});
