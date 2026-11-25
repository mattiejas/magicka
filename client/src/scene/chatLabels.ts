// Chat lines above the heads of the players who said them. Which lines show: speech.ts.
import { centreOf, state } from '../net/state';
import { isBlocked } from '../ui/players';
import type { Project } from './overlay';
import { SPOKEN_MS, type Speech, type Spoken, say, stillShown } from './speech';
import { COLUMN_HEIGHT } from './xpLabels';

const FADE_MS = 400;
/** Space between your own line and the XP gains under it. */
const XP_GAP_PX = 4;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export class ChatLabels {
  private speech: Speech = new Map();
  private labels = new Map<string, HTMLElement>();

  constructor(
    private root: HTMLElement,
    private project: Project,
    private heightOf: (id: string) => number,
    /** In pixels, so that your own line sits on top of your XP gains. */
    private xpHeight: () => number,
  ) {}

  say(speaker: string, text: string) {
    if (!state.self) return;
    this.speech = say(this.speech, speaker, { text, at: performance.now(), map: state.self.map });
  }

  forget() {
    this.speech = new Map();
    this.removeSilent();
  }

  update(now: number) {
    this.speech = stillShown(this.speech, now, canShow);
    this.removeSilent();
    for (const [speaker, line] of this.speech) this.place(speaker, line, now);
  }

  private removeSilent() {
    for (const [speaker, label] of this.labels) {
      if (this.speech.has(speaker)) continue;
      label.remove();
      this.labels.delete(speaker);
    }
  }

  private place(speaker: string, line: Spoken, now: number) {
    const label = this.labelFor(speaker);
    if (label.textContent !== line.text) label.textContent = line.text;
    const [x, z] = centreOf(state.entities.get(speaker)!);
    const screen = this.project(x, z, this.heightOf(speaker) + COLUMN_HEIGHT);
    label.style.display = screen.visible ? '' : 'none';
    const xp = speaker === state.me ? this.xpHeight() : 0;
    const y = screen.y - (xp ? xp + XP_GAP_PX : 0);
    label.style.transform = `translate(${screen.x | 0}px,${y | 0}px) translate(-50%,-100%)`;
    const left = SPOKEN_MS - (now - line.at);
    label.style.opacity = reducedMotion.matches ? '' : String(Math.min(1, left / FADE_MS));
  }

  private labelFor(speaker: string): HTMLElement {
    let label = this.labels.get(speaker);
    if (!label) {
      label = document.createElement('div');
      label.className = 'chat-line';
      this.labels.set(speaker, label);
    }
    // The login screen empties the overlay.
    if (!label.isConnected) this.root.append(label);
    return label;
  }
}

/** Only players in sight and alive speak overhead, and not those you blocked. */
function canShow(speaker: string, line: Spoken): boolean {
  const entity = state.entities.get(speaker)?.entity;
  if (!entity || entity.kind !== 'player' || (entity.hp ?? 1) <= 0) return false;
  return !isBlocked(entity.name ?? '') && state.self?.map === line.map;
}
