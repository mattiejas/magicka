// XP gains of your own character, in a column above their head. Which gains there are: ui/xpGains.ts.
import { centreOf, myTrack, state } from '../net/state';
import { skillIcon } from '../ui/icons/skills';
import {
  clearXp,
  liveGains,
  onXpCleared,
  type Presence,
  SHOWN_MS,
  shouldForget,
  type XpGain,
} from '../ui/xpGains';
import type { Project } from './overlay';

/** Above the head, in world units, so the column clears the name, the health bar and damage numbers. */
const COLUMN_HEIGHT = 1.35;
const FADE_MS = 400;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export class XpLabels {
  private element = document.createElement('div');
  private drawn = '';
  private presence: Presence | null = null;

  constructor(
    private root: HTMLElement,
    private project: Project,
    private heightOf: (id: string) => number,
  ) {
    this.element.className = 'xp-gains';
    onXpCleared(() => this.hide());
  }

  update(now: number) {
    const track = myTrack();
    const after: Presence | null =
      track && state.self
        ? {
            me: state.me,
            map: state.self.map,
            tile: [track.entity.x, track.entity.y],
            alive: (track.entity.hp ?? 1) > 0,
          }
        : null;
    if (shouldForget(this.presence, after)) clearXp();
    this.presence = after;

    const gains = after ? liveGains(now) : [];
    if (!track || !gains.length) return this.hide();
    const [x, z] = centreOf(track);
    const screen = this.project(x, z, this.heightOf(state.me) + COLUMN_HEIGHT);
    if (!screen.visible) return this.hide();
    // The login screen empties the overlay.
    if (!this.element.isConnected) this.root.append(this.element);
    this.draw(gains);
    const age = now - Math.max(...gains.map(gain => gain.at));
    this.element.style.display = '';
    this.element.style.opacity = reducedMotion.matches ? '' : String(Math.min(1, (SHOWN_MS - age) / FADE_MS));
    this.element.style.transform = `translate(${screen.x | 0}px,${screen.y | 0}px) translate(-50%,-100%)`;
  }

  private hide() {
    this.element.style.display = 'none';
    this.drawn = '';
  }

  /** Rebuilds the lines only when what they say changes. */
  private draw(gains: readonly XpGain[]) {
    const key = gains.map(({ skill, amount }) => `${skill}${amount}`).join();
    if (key === this.drawn) return;
    this.drawn = key;
    this.element.replaceChildren(
      ...gains.map(({ skill, amount }) => {
        const line = document.createElement('div');
        line.className = 'xp-gain';
        line.innerHTML = skillIcon(skill, 'xp-icon', skill);
        line.append(`+${amount} XP`);
        return line;
      }),
    );
  }
}
