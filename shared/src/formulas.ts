import type { Style } from './content';
export const TICK_MS = 600;
export const MAX_LEVEL = 50;
export const ticks = (seconds: number) => Math.ceil((seconds * 1000) / TICK_MS);
export const xpForLevel = (n: number) => Math.floor(25 * (n - 1) ** 2.2);
export function levelForXp(xp: number): number {
  let n = 1;
  while (n < MAX_LEVEL && xp >= xpForLevel(n + 1)) n++;
  return n;
}
export const maxHp = (vitality: number) => 20 + 3 * vitality;
const BEATS: Record<Style, Style> = { melee: 'ranged', ranged: 'magic', magic: 'melee' };
export function styleModifier(attacker: Style, defender: Style | null): number {
  if (!defender || attacker === defender) return 1;
  return BEATS[attacker] === defender ? 1.2 : 0.8;
}
export function hitChance(
  level: number,
  accuracy: number,
  defence: number,
  armour: number,
  mod: number,
): number {
  const a = 10 + level * 1.5 + accuracy,
    d = 6 + defence + armour;
  return Math.max(0.1, Math.min(0.95, (a / (a + d)) * 1.25 * mod));
}
export const maxHit = (level: number, power: number) => Math.floor(2 + level * 0.22 + power * 0.35);
export const bossMaxHp = (base: number, players: number) =>
  Math.round(base * (1 + 0.5 * (Math.max(1, players) - 1)));
/** Chance per attempt of a successful gather. */
export const gatherChance = (level: number, req: number, toolTier: number) =>
  Math.min(0.95, 0.3 + (level - req) * 0.015 + toolTier * 0.08);

/** What a shop pays for some items, rounded down. */
export const sellPrice = (value: number, qty: number, percent: number) =>
  Math.floor((value * qty * percent) / 100);
/** What reclaiming some items costs after dying: rounded up, and at least one coin. */
export const deathFee = (value: number, qty: number, percent: number) =>
  Math.max(1, Math.ceil((value * qty * percent) / 100));
