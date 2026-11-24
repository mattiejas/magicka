import type { Stack } from '@magicka/shared';
import { send } from '../../net/connection';
import { button, h } from '../dom';
import { itemSlot } from '../items';
import type { Panel } from '.';

const items = (stacks: Stack[]) =>
  h('div', { class: 'grid spaced' }, ...stacks.map(stack => itemSlot(stack)));

export const reaperPanel: Panel = {
  title: 'Reaper',
  render({ reaper, kept }) {
    if (!reaper.length && !kept.length) return [h('p', {}, 'Nothing of yours has come to me.')];
    return [
      ...(kept.length ? [h('p', {}, 'You earned this and left it lying. I kept it safe.'), items(kept)] : []),
      ...(reaper.length
        ? [h('p', {}, 'I kept what you dropped. Take it, there is no charge.'), items(reaper)]
        : []),
      button('Take my items', () => send({ type: 'claim' })),
    ];
  },
};
