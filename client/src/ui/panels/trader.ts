// A stranded trader, who buys one material for more than any shop pays.
import { ITEMS } from '@driftwake/shared';
import { send } from '../../net/connection';
import { state } from '../../net/state';
import { button, h } from '../dom';
import { icon } from '../icons';
import { ALL_ITEMS, carried, coins, describe } from '../items';
import type { Panel } from '.';

/** In per cent of shop value. Keep in step with traderPercent on the server. */
const PAYS = 200;

const traderInSight = () =>
  [...state.entities.values()].find(({ entity }) => entity.kind === 'npc' && entity.type === 'trader')
    ?.entity;

export const traderPanel: Panel = {
  title: 'Stranded trader',
  place: traderInSight,
  key() {
    const wants = traderInSight()?.wants;
    return JSON.stringify(wants ? [wants, carried(wants)] : null);
  },
  render() {
    const wants = traderInSight()?.wants;
    if (!wants) return [h('p', {}, 'The trader has moved on.')];
    const { name, value } = ITEMS[wants];
    const sell = (label: string, qty: number) =>
      button(label, () => send({ type: 'sellToTrader', qty }), { disabled: !carried(wants) });
    return [
      h('p', {}, 'My cart broke, and my buyer will not wait. Sell me what you can spare, I pay well.'),
      h(
        'div',
        { class: 'recipe', title: describe(wants) },
        h('span', { html: icon(wants) }),
        h(
          'div',
          {},
          name,
          h('small', { class: 'num' }, `${coins((value * PAYS) / 100)} each, ${carried(wants)} carried`),
        ),
        h('div', { class: 'btns' }, sell('1', 1), sell('5', 5), sell('All', ALL_ITEMS)),
      ),
    ];
  },
};
