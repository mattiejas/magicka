// Getting back what was lost by dying, at the grave or from the reaper.
import { deathFee, ECONOMY, ITEMS, type SelfState, type Stack } from '@driftwake/shared';
import { send } from '../../net/connection';
import { state } from '../../net/state';
import { button, h } from '../dom';
import { icon } from '../icons';
import { coins, describe } from '../items';
import type { Panel } from '.';
import { atStation } from './place';

const FREE = 0;

function row({ id, qty }: Stack, fee: number, funds: number): HTMLElement {
  const { name } = ITEMS[id];
  const tooDear = fee > funds ? 'no' : '';
  const price = fee === FREE ? 'Free' : coins(fee);
  const take = button('Take', () => send({ type: 'claim', item: id }), {
    'data-focus': `take-${id}`,
    'aria-label': `Take ${name}`,
  });
  return h(
    'div',
    { class: 'recipe', title: describe(id) },
    h('span', { html: icon(id) }),
    h(
      'div',
      {},
      name + (qty > 1 ? ` x${qty}` : ''),
      h('small', { class: 'num' }, h('span', { class: tooDear }, price)),
    ),
    h('div', { class: 'btns' }, take),
  );
}

/** Everything a fee can be paid with: carried, banked and lost coins. */
function fundsOf({ inv, bank, reaper }: SelfState): number {
  const stacks = [...inv, ...bank, ...reaper];
  return stacks.reduce((total, stack) => total + (stack?.id === 'coin' ? stack.qty : 0), 0);
}

const lostRows = (self: SelfState, percent: number) =>
  self.reaper.map(stack => {
    // Coins pay their own fee.
    const funds = stack.id === 'coin' ? Infinity : fundsOf(self);
    return row(stack, deathFee(ITEMS[stack.id].value, stack.qty, percent), funds);
  });

const takeAll = () =>
  h(
    'div',
    { class: 'actions' },
    button('Take all I can afford', () => send({ type: 'claim' })),
  );

const PAID_FROM = 'Fees are paid with the coins you carry, bank or lost.';

export const gravePanel: Panel = {
  title: 'Your grave',
  place: () => state.entities.get('grave')?.entity,
  key: ({ reaper, inv, bank }) => JSON.stringify([reaper, inv, bank]),
  render(self) {
    const { graveFeePercent } = ECONOMY;
    return [
      h('p', {}, `Taking something back costs ${graveFeePercent}% of its value. ${PAID_FROM}`),
      ...lostRows(self, graveFeePercent),
      takeAll(),
    ];
  },
};

let asked = false;

function ask() {
  asked = true;
  send({ type: 'askFees' });
}

function reaperTotal(): HTMLElement {
  const { feesTaken } = state;
  if (!asked || feesTaken === null)
    return h('div', { class: 'actions' }, button('How much have you taken?', ask));
  const answer = feesTaken
    ? `From all of you together, ${coins(feesTaken)}. Death is patient work.`
    : 'Not a coin, so far. I can wait.';
  return h('p', {}, answer);
}

export const reaperPanel: Panel = {
  title: 'Reaper',
  place: atStation('reaper'),
  key: ({ reaper, kept, inv, bank }) => JSON.stringify([reaper, kept, inv, bank, asked && state.feesTaken]),
  onOpen() {
    asked = false;
  },
  render(self) {
    const { reaper, kept } = self;
    const { reaperFeePercent, graveFeePercent } = ECONOMY;
    if (!reaper.length && !kept.length)
      return [h('p', {}, 'Nothing of yours has come to me.'), reaperTotal()];
    const body: Node[] = [];
    if (kept.length)
      body.push(
        h('p', {}, 'You earned this and left it lying. I kept it safe.'),
        ...kept.map(stack => row(stack, FREE, 0)),
      );
    if (reaper.length)
      body.push(
        h(
          'p',
          {},
          `You lost this. I ask ${reaperFeePercent}% of its value. At your grave it is ${graveFeePercent}%. ${PAID_FROM}`,
        ),
        ...lostRows(self, reaperFeePercent),
      );
    return [...body, takeAll(), reaperTotal()];
  },
};
