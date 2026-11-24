// Name, health and the character's menu buttons.
import { maxHp } from '@driftwake/shared';
import { logout } from '../net/connection';
import { myTrack, state } from '../net/state';
import { bar, button, byId, h, renderIfChanged } from './dom';
import { level } from './items';
import { showLogin } from './login';
import { togglePanel } from './panels';
import { openSettings } from './settingsModal';

const LOW_HEALTH = 0.3;

export function updateVitals() {
  const { self } = state;
  const element = byId('vitals');
  if (!self || !element) return;
  const max = maxHp(level('vitality'));
  const hp = myTrack()?.entity.hp ?? max;
  renderIfChanged(element, `${hp}/${max}`, () => [
    h('h2', {}, self.name),
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'mute' }, 'Health'),
      h('span', { class: 'num' }, `${hp} / ${max}`),
    ),
    bar(hp / max, hp < max * LOW_HEALTH ? 'low' : ''),
    h(
      'div',
      { class: 'btns' },
      button('Hair', () => togglePanel('hair')),
      button('Settings', openSettings),
      button('Log out', leave),
    ),
  ]);
}

function leave() {
  logout();
  showLogin();
}
