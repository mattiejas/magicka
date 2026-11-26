// Sailing by keyboard and mouse: the sail setting, the course, steering by hand and going ashore.
import type { TilePos } from '@driftwake/shared';
import { send } from './net/connection';
import { myTrack, state } from './net/state';
import type { Option } from './things';

const FULL_SAIL = 3;
/** A raised or lowered sail counts from the setting just sent, until the server has had time to answer. */
const ANSWER_MS = 900;
/** How close to a moored boat a click boards it, in tiles from its middle. */
const BOARD_REACH = 1.8;

const keySettings: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3 };
let sent: { sail: number; at: number } | null = null;
let steering: string | null = null;

export const isAboard = () => !!state.voyage;

/** The sail setting a change counts from: the boat's, or the one just asked for. */
function currentSail(): number {
  const boat = myTrack()?.entity.boat;
  const recent = sent && performance.now() - sent.at < ANSWER_MS ? sent.sail : null;
  return recent ?? boat?.sail ?? 1;
}

function setSail(sail: number) {
  const setting = Math.max(0, Math.min(FULL_SAIL, sail));
  sent = { sail: setting, at: performance.now() };
  send({ type: 'setSail', sail: setting });
}

/** Handles a key pressed aboard, and reports whether it was one for the boat. */
export function helmKeyDown(event: KeyboardEvent): boolean {
  if (!isAboard()) return false;
  const key = event.key.toLowerCase();
  if (key === 'a' || key === 'd') {
    if (steering !== key) send({ type: 'helm', turn: key === 'a' ? -1 : 1 });
    steering = key;
  } else if (key === 'w' || key === 's') setSail(currentSail() + (key === 'w' ? 1 : -1));
  else if (key in keySettings) setSail(keySettings[key]);
  else if (key === ' ') send({ type: 'goAshore' });
  else return false;
  return true;
}

export function helmKeyUp(event: KeyboardEvent) {
  if (steering && event.key.toLowerCase() === steering) letGo();
}

/** Lets go of the helm, as when the window loses the keyboard. */
export function letGo() {
  if (!steering) return;
  steering = null;
  if (isAboard()) send({ type: 'helm', turn: 0 });
}

export const steer = ([x, y]: TilePos) => send({ type: 'steer', x, y });

export const chooseSail = setSail;

/** Boarding the player's own boat, moored beside a clicked tile. */
export function boardOption(tile: TilePos | null): Option | null {
  const boat = myTrack()?.entity.boat;
  if (!tile || !boat || boat.aboard || isAboard()) return null;
  const near = Math.hypot(tile[0] + 0.5 - boat.x, tile[1] + 0.5 - boat.y) <= BOARD_REACH;
  return near ? ['Board your boat', () => send({ type: 'board' })] : null;
}
