// The panel on the left: one station's window, or the hair picker.
import type { ClientMsg, SelfState, StationType } from '@driftwake/shared';
import { myTrack, state } from '../../net/state';
import { button, byId, h, uiRoot } from '../dom';
import { hideTooltip } from '../popups';
import { bankPanel } from './bank';
import { craftingPanel } from './crafting';
import { dockPanel } from './dock';
import { hairPanel } from './hair';
import { lampPanel } from './lamp';
import type { Place } from './place';
import { gravePanel, reaperPanel } from './reclaim';
import { shopPanel } from './shop';
import { tradePanel } from './trade';
import { traderPanel } from './trader';

/** What is done with items in the inventory while a panel is open. */
interface ItemUse {
  /** Replaces what clicking the item does otherwise. */
  click: (item: string) => ClientMsg;
  /** Added to the item's right-click menu. */
  menu: (item: string) => [label: string, msg: ClientMsg][];
}
export interface Panel {
  title: string;
  place: Place;
  render: (self: SelfState, refresh: () => void) => (Node | string)[];
  onOpen?: () => void;
  onClose?: () => void;
  /**
   * Everything the panel shows that can change. It is only redrawn when this does, so updates never swallow a
   * click or the focus.
   */
  key: (self: SelfState) => string;
  itemUse?: ItemUse;
}
/** The mine entrance is walked through, not opened. */
export type PanelId = Exclude<StationType, 'mine'> | 'grave' | 'hair' | 'trade' | 'trader' | 'lamp';

const PANELS: Record<PanelId, Panel> = {
  bank: bankPanel,
  furnace: craftingPanel('furnace', 'Furnace'),
  anvil: craftingPanel('anvil', 'Anvil'),
  workbench: craftingPanel('workbench', 'Workbench'),
  shop: shopPanel,
  reaper: reaperPanel,
  grave: gravePanel,
  dock: dockPanel,
  hair: hairPanel,
  trade: tradePanel,
  trader: traderPanel,
  lamp: lampPanel,
};
/** How far a player may walk from a station before its panel closes. */
const STATION_REACH = 2;

let openPanelId: PanelId | null = null;
let drawnKey: string | null = null;

const isPanelOpen = (id: PanelId) => openPanelId === id;

/** The panel that is open, if any. */
export const currentPanel = (): Panel | null => openPanelId && PANELS[openPanelId];

/** Whether there is such a panel. The server may name one that this client does not know. */
export const isPanelId = (id: string): id is PanelId => Object.hasOwn(PANELS, id);

export function openPanel(id: PanelId) {
  closePanel();
  openPanelId = id;
  PANELS[id].onOpen?.();
  updatePanel();
}

export function togglePanel(id: PanelId) {
  if (isPanelOpen(id)) closePanel();
  else openPanel(id);
}

export function closePanel() {
  const closed = currentPanel();
  openPanelId = null;
  drawnKey = null;
  element()?.remove();
  hideTooltip();
  closed?.onClose?.();
}

/** Shows the trade window while there is a trade. */
export function showTrade() {
  if (!state.trade) {
    if (isPanelOpen('trade')) closePanel();
  } else if (isPanelOpen('trade')) updatePanel();
  else openPanel('trade');
}

const element = () => byId('station');

/** Redraws the open panel if what it shows has changed, keeping its scroll position and keyboard focus. */
export function updatePanel() {
  const { self } = state;
  const panel = currentPanel();
  if (!panel || !self) return;
  const key = panel.key(self);
  const old = element();
  if (old && key === drawnKey) return;
  drawnKey = key;

  const body = h('div', { class: 'body' });
  body.append(...panel.render(self, updatePanel));
  const drawn = h(
    'div',
    { id: 'station', class: 'panel', role: 'dialog', 'aria-label': panel.title },
    h('header', {}, h('h2', {}, panel.title), button('Close', closePanel)),
    body,
  );
  const scroll = old?.querySelector('.body')?.scrollTop ?? 0;
  const focused = (document.activeElement as HTMLElement | null)?.dataset?.focus;
  if (old) old.replaceWith(drawn);
  else uiRoot().append(drawn);
  body.scrollTop = scroll;
  if (focused) drawn.querySelector<HTMLElement>(`[data-focus="${focused}"]`)?.focus();
}

export function closePanelWhenFar() {
  const me = myTrack()?.entity;
  const panel = currentPanel();
  if (!panel || panel.place === 'anywhere' || !state.self || !me) return;
  const place = panel.place(state.self.map);
  if (!place || Math.max(Math.abs(me.x - place.x), Math.abs(me.y - place.y)) > STATION_REACH) closePanel();
}
