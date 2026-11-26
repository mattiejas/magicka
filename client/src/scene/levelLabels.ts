// New levels above the heads of players nearby, your own above your XP gains. Which levels show: levelUps.ts.
import type { Skill } from '@driftwake/shared';
import { centreOf, state } from '../net/state';
import { skillIcon } from '../ui/icons/skills';
import { addLevelUp, LEVEL_SHOWN_MS, type LevelUp, type LevelUps, levelsShown } from './levelUps';
import type { Project } from './overlay';
import { COLUMN_HEIGHT } from './xpLabels';

const FADE_MS = 600;
/** Space between the levels and what is under them. */
export const STACK_GAP_PX = 4;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export class LevelLabels {
  private levelUps: LevelUps = new Map();
  private labels = new Map<string, HTMLElement>();
  private drawn = new WeakMap<HTMLElement, string>();

  constructor(
    private root: HTMLElement,
    private project: Project,
    private heightOf: (id: string) => number,
    /** In pixels: what sits between the head and the levels, such as your own XP gains. */
    private beneath: (player: string) => number,
  ) {}

  add(player: string, skill: Skill, level: number) {
    this.levelUps = addLevelUp(this.levelUps, player, { skill, level, at: performance.now() });
  }

  forget() {
    this.levelUps = new Map();
    this.removeUnshown();
  }

  /** In pixels; nothing when no level of the player is showing. */
  height(player: string): number {
    return this.labels.get(player)?.offsetHeight ?? 0;
  }

  update(now: number) {
    this.levelUps = levelsShown(this.levelUps, now, canShow);
    this.removeUnshown();
    for (const [player, levels] of this.levelUps) this.place(player, levels, now);
  }

  private removeUnshown() {
    for (const [player, label] of this.labels) {
      if (this.levelUps.has(player)) continue;
      label.remove();
      this.labels.delete(player);
    }
  }

  private place(player: string, levels: readonly LevelUp[], now: number) {
    const label = this.labelFor(player);
    this.draw(label, levels);
    const [x, z] = centreOf(state.entities.get(player)!);
    const screen = this.project(x, z, this.heightOf(player) + COLUMN_HEIGHT);
    label.style.display = screen.visible ? '' : 'none';
    const below = this.beneath(player);
    const y = screen.y - (below ? below + STACK_GAP_PX : 0);
    label.style.transform = `translate(${screen.x | 0}px,${y | 0}px) translate(-50%,-100%)`;
    const left = LEVEL_SHOWN_MS - (now - Math.max(...levels.map(levelUp => levelUp.at)));
    label.style.opacity = reducedMotion.matches ? '' : String(Math.min(1, left / FADE_MS));
  }

  /** Rebuilds the lines only when what they say changes, so that a new line pops and the others stay. */
  private draw(label: HTMLElement, levels: readonly LevelUp[]) {
    const key = levels.map(({ skill, level, at }) => `${skill}${level}@${at}`).join();
    if (this.drawn.get(label) === key) return;
    this.drawn.set(label, key);
    label.replaceChildren(
      ...levels.map(({ skill, level }) => {
        const line = document.createElement('div');
        line.className = 'level-up';
        line.innerHTML = skillIcon(skill, 'level-icon', skill);
        line.append(`Level ${level}`);
        return line;
      }),
    );
  }

  private labelFor(player: string): HTMLElement {
    let label = this.labels.get(player);
    if (!label) {
      label = document.createElement('div');
      label.className = 'level-ups';
      this.labels.set(player, label);
    }
    // The login screen empties the overlay.
    if (!label.isConnected) this.root.append(label);
    return label;
  }
}

/** Only players in sight and alive show their levels. */
function canShow(player: string): boolean {
  const entity = state.entities.get(player)?.entity;
  return !!entity && entity.kind === 'player' && (entity.hp ?? 1) > 0;
}
