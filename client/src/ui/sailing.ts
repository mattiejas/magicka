// The helm while aboard: the sail setting, the speed, and going ashore.
import { chooseSail } from '../helm';
import { SAIL_SETTINGS } from '../models';
import { send } from '../net/connection';
import { myTrack, state } from '../net/state';
import { button, byId, h, renderIfChanged } from './dom';

const WALKING_SPEED = 2;

export const sailingPanel = () => h('div', { id: 'sailing', class: 'panel', hidden: true });

export function updateSailing() {
  const element = byId('sailing');
  const { voyage } = state;
  const boat = myTrack()?.entity.boat;
  if (!element) return;
  element.hidden = !voyage || !boat?.aboard;
  if (element.hidden) return;
  const { speed, shoreNear, slowEnough } = voyage!;
  const sail = boat!.sail;
  const ashore = shoreNear && slowEnough;
  const why = !shoreNear ? 'No shore close enough.' : !slowEnough ? 'Too fast: take in sail first.' : '';
  const key = JSON.stringify([sail, speed.toFixed(1), ashore, why]);
  renderIfChanged(element, key, () => [
    h(
      'div',
      { class: 'sails' },
      ...SAIL_SETTINGS.map((label, i) =>
        button(label, () => chooseSail(i), { class: i === sail ? 'on' : '', title: `Key ${i + 1}` }),
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('span', { class: 'num' }, describeSpeed(speed)),
      button('Go ashore', () => send({ type: 'goAshore' }), { disabled: !ashore, title: why || 'Space' }),
    ),
    h('small', {}, 'Click to steer · W S sail · A D steer by hand · Space go ashore'),
  ]);
}

function describeSpeed(speed: number): string {
  if (Math.abs(speed) < 0.05) return 'Stopped';
  const astern = speed < 0 ? ', astern' : '';
  return `${Math.abs(speed).toFixed(1)} tiles a tick${astern} (walking is ${WALKING_SPEED})`;
}
