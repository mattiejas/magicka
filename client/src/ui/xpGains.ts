// XP gains shown above the player: added together per skill while they keep coming, then gone.
import type { MapId, Skill, TilePos } from '@driftwake/shared';

/** How long a line stays after the latest gain in its skill. */
export const SHOWN_MS = 1800;

export interface XpGain {
  skill: Skill;
  amount: number;
  /** When the latest gain in this skill came. */
  at: number;
}

/** Adds to the line of the skill, or starts one after the others so the lines keep their order. */
export function addGain(gains: readonly XpGain[], skill: Skill, amount: number, now: number): XpGain[] {
  const existing = gains.find(gain => gain.skill === skill);
  if (!existing) return [...gains, { skill, amount, at: now }];
  return gains.map(gain => (gain === existing ? { skill, amount: gain.amount + amount, at: now } : gain));
}

export const withoutExpired = (gains: readonly XpGain[], now: number): XpGain[] =>
  gains.filter(gain => now - gain.at < SHOWN_MS);

let current: XpGain[] = [];

export function showXp(skill: Skill, amount: number) {
  current = addGain(current, skill, amount, performance.now());
}

/** The lines to show now. */
export function liveGains(now: number): readonly XpGain[] {
  current = withoutExpired(current, now);
  return current;
}

const clearListeners: (() => void)[] = [];

/** Calls `listener` whenever the gains are cleared, so that what shows them can go at once. */
export const onXpCleared = (listener: () => void) => clearListeners.push(listener);

export function clearXp() {
  current = [];
  for (const listener of clearListeners) listener();
}

/** Where the player is. Gains are forgotten when this changes in a way that is no walk. */
export interface Presence {
  me: string;
  map: MapId;
  tile: TilePos;
  alive: boolean;
}

/** Further than a walk of one tick can go: dying and returning, or a boat or stairs. */
const JUMP_TILES = 3;

export function shouldForget(before: Presence | null, after: Presence | null): boolean {
  if (!after) return true;
  if (!before) return false;
  if (before.me !== after.me || before.map !== after.map || !after.alive) return true;
  return (
    Math.max(Math.abs(before.tile[0] - after.tile[0]), Math.abs(before.tile[1] - after.tile[1])) > JUMP_TILES
  );
}
