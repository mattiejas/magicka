// A health bar that shows what the last hit took: the lost part turns red, waits, then shrinks away.
import { h } from './dom';

/** How long the red part waits after a hit before it shrinks. The reduced-motion rule in style.css repeats it. */
export const HOLD_MS = 400;
export const SHRINK_MS = 500;
/** How long the bar takes to grow when healed. */
export const GROW_MS = 200;

/** Which way the bar fills: `width` for a bar lying down, `height` for one standing up. */
export type Axis = 'width' | 'height';

export interface BarTransitions {
  fill: string;
  trail: string;
}

/**
 * How the fill and the red trail behind it move from the share of health shown to a new one.
 *
 * On a hit the fill drops at once and the trail waits, then shrinks. A CSS transition that is replaced
 * starts from where it is, so a hit during the shrink holds the red from there and covers both hits.
 * On healing the trail grows along with the fill, hidden behind it, so no red shows.
 */
export function transitionsTo(axis: Axis, shown: number, share: number): BarTransitions {
  if (share < shown) return { fill: 'none', trail: `${axis} ${SHRINK_MS}ms ease-out ${HOLD_MS}ms` };
  const grow = `${axis} ${GROW_MS}ms`;
  return { fill: grow, trail: grow };
}

/** Keeps the share between 0 and 1, so overkill and bad data draw a sensible bar. */
export const clampShare = (share: number) => (Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0);

/**
 * A fill and a red trail kept inside `track` between updates, so that CSS can animate them.
 * The track's own class gives its size and colours; `damage` and the axis class place the two parts.
 */
export class DamageBar {
  private trail = h('i', { class: 'trail' });
  private fill = h('i', { class: 'fill' });
  private shown: number | undefined;

  constructor(
    readonly track: HTMLElement,
    private axis: Axis,
  ) {
    track.classList.add('damage', axis === 'width' ? 'across' : 'up');
    track.replaceChildren(this.trail, this.fill);
  }

  /** Shows a share of health between 0 and 1. Called often; does nothing while the share is unchanged. */
  set(share: number) {
    const next = clampShare(share);
    if (next === this.shown) return;
    const transitions = transitionsTo(this.axis, this.shown ?? next, next);
    this.fill.style.transition = transitions.fill;
    this.trail.style.transition = transitions.trail;
    this.fill.style[this.axis] = `${next * 100}%`;
    this.trail.style[this.axis] = `${next * 100}%`;
    this.shown = next;
  }
}
