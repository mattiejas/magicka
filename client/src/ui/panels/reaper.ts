import { send } from '../../net/connection';
import { button, h } from '../dom';
import { itemSlot } from '../items';
import type { Panel } from '.';

export const reaperPanel: Panel = {
  title: 'Reaper',
  render({ reaper }) {
    if (!reaper.length) return [h('p', {}, 'Nothing of yours has come to me.')];
    return [
      h('p', {}, 'I kept what you dropped. Take it, there is no charge.'),
      h('div', { class: 'grid spaced' }, ...reaper.map(stack => itemSlot(stack))),
      button('Take my items', () => send({ type: 'claim' })),
    ];
  },
};
