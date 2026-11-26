// Who may take a pile on the ground and for how long, as a label shows it.
import { TICK_MS } from '@driftwake/shared';
import type { TakeIcon } from '../ui/icons/take';

const HURRY_SECONDS = 15;

export interface Timer {
  icon: TakeIcon;
  /** What the icon means, shown on hover. */
  meaning: string;
  /** Minutes and seconds left, or empty when nothing runs out. */
  time: string;
  hurry: boolean;
}

/** `publicAt` 0 means the pile stays with its owner; a unique of theirs then goes to the reaper. */
export function timerFor(unique: boolean, until: number, publicAt: number, now: number): Timer {
  if (unique && publicAt === 0) return timer('scythe', 'to the reaper in', until, now);
  if (publicAt === 0) return { icon: 'closedEye', meaning: 'private', time: '', hurry: false };
  if (publicAt > now) return timer('closedEye', 'public in', publicAt, now);
  return timer('openEye', 'public, gone in', until, now);
}

function timer(icon: TakeIcon, words: string, tick: number, now: number): Timer {
  const seconds = Math.max(0, Math.ceil(((tick - now) * TICK_MS) / 1000));
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return { icon, meaning: `${words} ${time}`, time, hurry: seconds <= HURRY_SECONDS };
}

/** "Coins ×1,250"; one of a kind shows the name alone. */
export const pileName = (name: string, qty: number) =>
  qty > 1 ? `${name} ×${qty.toLocaleString('en')}` : name;
