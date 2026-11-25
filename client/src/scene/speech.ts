// Chat lines shown above their speakers' heads: the latest line of each player, for a few seconds.
import type { MapId } from '@driftwake/shared';

export const SPOKEN_MS = 5000;

export interface Spoken {
  text: string;
  at: number;
  /** The map you were on when it was said. Changing maps silences everyone. */
  map: MapId;
}

export type Speech = ReadonlyMap<string, Spoken>;

/** A newer line from the same speaker replaces the one showing. */
export function say(speech: Speech, speaker: string, line: Spoken): Map<string, Spoken> {
  return new Map(speech).set(speaker, line);
}

/** The lines still showing. A line goes for good once it is old or `canShow` turns it down. */
export function stillShown(
  speech: Speech,
  now: number,
  canShow: (speaker: string, line: Spoken) => boolean,
): Map<string, Spoken> {
  const shown = new Map<string, Spoken>();
  for (const [speaker, line] of speech) {
    if (now - line.at < SPOKEN_MS && canShow(speaker, line)) shown.set(speaker, line);
  }
  return shown;
}
