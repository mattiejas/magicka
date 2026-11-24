// The player's preferences, kept in this browser.
export interface Settings {
  showFps: boolean;
}

const STORAGE_KEY = 'settings';
const DEFAULTS: Settings = { showFps: false };

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

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return { showFps: typeof saved?.showFps === 'boolean' ? saved.showFps : DEFAULTS.showFps };
  } catch {
    return { ...DEFAULTS };
  }
}
