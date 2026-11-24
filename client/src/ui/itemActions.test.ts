import { MAPS } from '@driftwake/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { state } from '../net/state';
import { clickAction, menuActions } from './itemActions';
import { ALL_ITEMS } from './items';
import { currentPanel, isPanelId } from './panels';
import { bankPanel } from './panels/bank';
import { hairPanel } from './panels/hair';
import { shopPanel } from './panels/shop';
import { tradePanel } from './panels/trade';

// The connection reads browser storage, and the portraits are drawn with WebGL.
vi.mock('../net/connection', () => ({ send: vi.fn() }));
vi.mock('./portrait', () => ({ portrait: vi.fn() }));

const SLOT = 3;
const ORE = 'copper_ore';
const SWORD = 'copper_sword';
const FOOD = 'ration';
const CAPE = 'cape_mining';
const PANELS_USING_ITEMS = [
  ['Deposit all', bankPanel, { type: 'bank', op: 'deposit' }],
  ['Sell all', shopPanel, { type: 'shop', op: 'sell' }],
  ['Offer all', tradePanel, { type: 'tradeStep', action: 'offer' }],
] as const;

const click = (id: string, panel: Parameters<typeof clickAction>[2] = null) =>
  clickAction({ id, qty: 1 }, SLOT, panel);
const menu = (id: string, panel: Parameters<typeof menuActions>[2] = null) =>
  menuActions({ id, qty: 1 }, SLOT, panel);
const labels = (id: string, panel: Parameters<typeof menuActions>[2] = null) =>
  menu(id, panel).map(([label]) => label);

beforeEach(() => {
  state.trade = null;
  state.tick = 0;
});

describe('clicking an item', () => {
  test('equips, eats or opens it while no panel is open', () => {
    expect(click(SWORD)).toEqual({ type: 'equip', slot: SLOT });
    expect(click(FOOD)).toEqual({ type: 'eat', slot: SLOT });
    expect(click('genie_lamp')).toEqual({ type: 'openPanel', panel: 'lamp' });
    expect(click(ORE)).toBeUndefined();
  });

  test.each(PANELS_USING_ITEMS)('goes to the panel that offers "%s"', (_label, panel, msg) => {
    for (const item of [ORE, SWORD, FOOD, 'genie_lamp'])
      expect(click(item, panel)).toEqual({ ...msg, item, qty: 1 });
  });

  test('is not changed by a panel that does nothing with items', () => {
    expect(click(SWORD, hairPanel)).toEqual(click(SWORD));
  });
});

describe('the menu of an item', () => {
  test('holds what can be done with it anywhere', () => {
    expect(menu(ORE)).toEqual([['Drop Copper ore', { type: 'drop', slot: SLOT }]]);
    expect(labels(SWORD)).toEqual(['Equip Copper sword', 'Drop Copper sword']);
    expect(labels(CAPE)).not.toContainEqual(expect.stringContaining('Drop'));
  });

  test.each(PANELS_USING_ITEMS)('has "%s" before dropping it', (label, panel, msg) => {
    expect(menu(ORE, panel)).toEqual([
      [label, { ...msg, item: ORE, qty: ALL_ITEMS }],
      ['Drop Copper ore', { type: 'drop', slot: SLOT }],
    ]);
  });

  test('offers to sell or trade only what can be', () => {
    expect(labels('coin', shopPanel)).not.toContain('Sell all');
    expect(labels('coin', tradePanel)).toContain('Offer all');
    expect(labels(CAPE, shopPanel)).not.toContain('Sell all');
    expect(labels(CAPE, tradePanel)).not.toContain('Offer all');
    expect(labels(CAPE, bankPanel)).toContain('Deposit all');
  });
});

test('the trade panel is redrawn once the trade can be accepted, not on every tick', () => {
  state.trade = { partner: 'Ann', mine: [], theirs: [], iAccepted: false, theyAccepted: false, readyAt: 5 };
  const keyAt = (tick: number) => {
    state.tick = tick;
    return tradePanel.key(null!);
  };
  expect(keyAt(4)).toBe(keyAt(3));
  expect(keyAt(5)).not.toBe(keyAt(4));
  expect(keyAt(6)).toBe(keyAt(5));
});

test('only panels of this client can be opened', () => {
  expect(isPanelId('bank')).toBe(true);
  for (const unknown of ['mine', 'casino', 'constructor', '']) expect(isPanelId(unknown)).toBe(false);
  expect(currentPanel()).toBeNull();
});

test('the bank panel belongs to the bank', () => {
  if (bankPanel.place === 'anywhere') throw new Error('it belongs somewhere');
  expect(bankPanel.place('island')).toBe(MAPS.island.stations.find(({ type }) => type === 'bank'));
});
