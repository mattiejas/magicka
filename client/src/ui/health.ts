// The player's health: a vertical bar beside the sidebar, seen whichever tab is open.
import { maxHp } from '@driftwake/shared';
import { myTrack, state } from '../net/state';
import { byId, h, renderIfChanged } from './dom';
import { level } from './items';

const LOW_HEALTH = 0.3;

export const healthBar = () =>
  h('div', { id: 'health', class: 'panel', role: 'meter', 'aria-label': 'Health', 'aria-valuemin': 0 });

export function updateHealth() {
  const element = byId('health');
  if (!state.self || !element) return;
  const max = maxHp(level('vitality'));
  const hp = myTrack()?.entity.hp ?? max;
  element.setAttribute('aria-valuenow', String(hp));
  element.setAttribute('aria-valuemax', String(max));
  element.setAttribute('aria-valuetext', `${hp} of ${max}`);
  element.classList.toggle('low', hp < max * LOW_HEALTH);
  renderIfChanged(element, `${hp}/${max}`, () => [
    h('b', { class: 'num' }, String(hp)),
    h('small', { class: 'num' }, String(max)),
    h('div', { class: 'fill' }, h('i', { style: `height:${(Math.max(0, hp) / max) * 100}%` })),
  ]);
}
