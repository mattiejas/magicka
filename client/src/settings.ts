// The player's preferences, kept in this browser.
import { isQuality, type Quality } from './quality';

export type LabelMode = 'all' | 'valuable' | 'none';

export interface Settings {
  showFps: boolean;
  quality: Quality;
  labelMode: LabelMode;
  /** Shop value in coins at which a pile counts as valuable. */
  labelThreshold: number;
}

const STORAGE_KEY = 'settings';
const LABEL_MODES: LabelMode[] = ['all', 'valuable', 'none'];
const DEFAULTS: Settings = { showFps: false, quality: 'high', labelMode: 'all', labelThreshold: 100 };

const current = load();
const listeners: ((settings: Settings) => void)[] = [];

export const settings = (): Readonly<Settings> => current;

export function changeSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  current[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage may be full or forbidden; the choice then lasts until the page is closed.
  }
  for (const listener of listeners) listener(current);
}

/** Called now, and again after every change. */
export function onSettings(listener: (settings: Settings) => void) {
  listeners.push(listener);
  listener(current);
}

function isLabelMode(value: unknown): value is LabelMode {
  return LABEL_MODES.includes(value as LabelMode);
}

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const threshold = saved?.labelThreshold;
    return {
      showFps: typeof saved?.showFps === 'boolean' ? saved.showFps : DEFAULTS.showFps,
      quality: isQuality(saved?.quality) ? saved.quality : DEFAULTS.quality,
      labelMode: isLabelMode(saved?.labelMode) ? saved.labelMode : DEFAULTS.labelMode,
      labelThreshold:
        typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0
          ? Math.floor(threshold)
          : DEFAULTS.labelThreshold,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
