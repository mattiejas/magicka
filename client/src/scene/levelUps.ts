// New levels shown above the heads of the players who reached them, for a few seconds. Where they show:
// levelLabels.ts.
import type { Skill } from '@driftwake/shared';

/** Longer than an XP gain shows, since a level is the bigger reward. */
export const LEVEL_SHOWN_MS = 4000;

export interface LevelUp {
  skill: Skill;
  level: number;
  at: number;
}

/** By player, the levels showing, oldest first. */
export type LevelUps = ReadonlyMap<string, readonly LevelUp[]>;

/** A newer level of the same skill replaces the one showing, and starts its time again. */
export function addLevelUp(levelUps: LevelUps, player: string, levelUp: LevelUp): LevelUps {
  const others = (levelUps.get(player) ?? []).filter(shown => shown.skill !== levelUp.skill);
  return new Map(levelUps).set(player, [...others, levelUp]);
}

/** The levels still showing, of players `canShow` lets through. */
export function levelsShown(
  levelUps: LevelUps,
  now: number,
  canShow: (player: string) => boolean,
): Map<string, LevelUp[]> {
  const shown = new Map<string, LevelUp[]>();
  for (const [player, levels] of levelUps) {
    const live = levels.filter(levelUp => now - levelUp.at < LEVEL_SHOWN_MS);
    if (live.length && canShow(player)) shown.set(player, live);
  }
  return shown;
}
