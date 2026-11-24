// XP that pops up above the bottom of the screen, added together while it keeps coming.
import type { Skill } from '@driftwake/shared';
import { byId, h } from './dom';

const SHOWN_MS = 1800;
interface Gain {
  amount: number;
  element: HTMLElement;
  timer: number;
}
const gains = new Map<Skill, Gain>();

export function showXp(skill: Skill, amount: number) {
  const container = byId('drops');
  if (!container) return;
  const previous = gains.get(skill);
  clearTimeout(previous?.timer);
  const element = previous?.element ?? h('div', { class: 'num' });
  const total = (previous?.amount ?? 0) + amount;
  const timer = window.setTimeout(() => {
    element.remove();
    gains.delete(skill);
  }, SHOWN_MS);
  gains.set(skill, { amount: total, element, timer });
  element.textContent = `${skill} +${total}`;
  if (!element.isConnected) container.append(element);
}
