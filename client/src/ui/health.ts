// The player's health: a vertical bar beside the sidebar, seen whichever tab is open.
import { maxHp } from '@driftwake/shared';
import { myTrack, state } from '../net/state';
import { DamageBar } from './damageBar';
import { byId, h } from './dom';
import { level } from './items';

const LOW_HEALTH = 0.3;

const bars = new WeakMap<HTMLElement, DamageBar>();

export function healthBar() {
  const track = h('div', { class: 'track' });
  const element = h(
    'div',
    { id: 'health', class: 'panel', role: 'meter', 'aria-label': 'Health', 'aria-valuemin': 0 },
    h('b', { class: 'num' }),
    h('small', { class: 'num' }),
    track,
  );
  bars.set(element, new DamageBar(track, 'height'));
  return element;
}

export function updateHealth() {
  const element = byId('health');
  const bar = element && bars.get(element);
  if (!state.self || !element || !bar) return;
  const max = maxHp(level('vitality'));
  const hp = myTrack()?.entity.hp ?? max;
  element.setAttribute('aria-valuenow', String(hp));
  element.setAttribute('aria-valuemax', String(max));
  element.setAttribute('aria-valuetext', `${hp} of ${max}`);
  element.classList.toggle('low', hp < max * LOW_HEALTH);
  element.querySelector('b')!.textContent = String(hp);
  element.querySelector('small')!.textContent = String(max);
  bar.set(hp / max);
}
