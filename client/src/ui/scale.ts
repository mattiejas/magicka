// The size the interface is drawn at: the player's choice, made smaller when it would not fit the window.
import { onSettings, settings, UI_SCALES, type UiScale } from '../settings';

/**
 * The window, in unscaled pixels, that the panels need so none covers another, measured in a browser:
 * the chat, the health bar and the sidebar side by side (16 + 380 + 8 + 40 + 272 + 16), and the minimap
 * with its buttons above the inventory, the tallest tab (16 + 301 + 8 + 380 + 16). A 1280 by 720 window
 * fits 100%, and 1920 by 1080 fits 150%.
 */
export const NEEDED_WIDTH = 740;
export const NEEDED_HEIGHT = 720;

let current: UiScale = 1;

/** The largest scale up to `chosen` at which the panels fit a window of this size; never below the smallest. */
export function fittingScale(chosen: UiScale, width: number, height: number): UiScale {
  const room = Math.min(width / NEEDED_WIDTH, height / NEEDED_HEIGHT);
  const fits = UI_SCALES.filter(scale => scale <= chosen && scale <= room);
  return fits.at(-1) ?? UI_SCALES[0];
}

/** The scale in use now. Positions from the mouse are divided by it to place things inside the interface. */
export const uiScale = () => current;

const listeners = new Set<() => void>();
/** Called after the scale in use changes. Returns a function that stops it. */
export function onUiScale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply() {
  const next = fittingScale(settings().uiScale, innerWidth, innerHeight);
  if (next === current && document.documentElement.style.getPropertyValue('--ui-scale')) return;
  current = next;
  document.documentElement.style.setProperty('--ui-scale', String(next));
  for (const listener of listeners) listener();
}

export function initUiScale() {
  onSettings(apply);
  addEventListener('resize', apply);
}
