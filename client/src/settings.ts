// The player's preferences, kept in this browser.
import { isQuality, type Quality } from './quality';

export type LabelMode = 'all' | 'valuable' | 'none';
/** How large the interface is drawn, as a share of its normal size. */
export const UI_SCALES = [0.75, 1, 1.25, 1.5] as const;
export type UiScale = (typeof UI_SCALES)[number];

export interface Settings {
  showFps: boolean;
  quality: Quality;
  labelMode: LabelMode;
  /** Shop value in coins at which a pile counts as valuable. */
  labelThreshold: number;
  uiScale: UiScale;
}

const STORAGE_KEY = 'settings';
const LABEL_MODES: LabelMode[] = ['all', 'valuable', 'none'];
const DEFAULTS: Settings = {
  showFps: false,
  quality: 'high',
  labelMode: 'all',
  labelThreshold: 100,
  uiScale: 1,
};

// Above `load`, which runs at once and would otherwise find it not yet defined.
const isUiScale = (value: unknown): value is UiScale => UI_SCALES.includes(value as UiScale);

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
      uiScale: isUiScale(saved?.uiScale) ? saved.uiScale : DEFAULTS.uiScale,
    };
  } catch {
    return { ...DEFAULTS };
  }
}
