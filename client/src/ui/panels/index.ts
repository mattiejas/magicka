// The panel on the left: one station's window, or the hair picker.
import { MAPS, type MapId, type SelfState, type StationType } from '@driftwake/shared';
import { myTrack, state } from '../../net/state';
import { button, byId, h, uiRoot } from '../dom';
import { hideTooltip } from '../popups';
import { bankPanel } from './bank';
import { craftingPanel } from './crafting';
import { dockPanel } from './dock';
import { hairPanel } from './hair';
import { lampPanel } from './lamp';
import { gravePanel, reaperPanel } from './reclaim';
import { shopPanel } from './shop';
import { tradePanel } from './trade';
import { traderInSight, traderPanel } from './trader';

export { clickQuantity } from './quantity';

export interface Panel {
  title: string;
  render: (self: SelfState, refresh: () => void) => (Node | string)[];
  onOpen?: () => void;
  onClose?: () => void;
  /** When given, the panel is only redrawn when this changes, so updates never swallow a click or the focus. */
  key?: (self: SelfState) => string;
}
/** The mine entrance is walked through, not opened. */
export type PanelId = Exclude<StationType, 'mine'> | 'grave' | 'hair' | 'trade' | 'trader' | 'lamp';
/** Panels that do not belong to a place. */
const ANYWHERE: PanelId[] = ['hair', 'trade', 'lamp'];

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

export const isPanelOpen = (id: PanelId) => openPanelId === id;

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
  const closed = openPanelId && PANELS[openPanelId];
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

/** Redraws the open panel, keeping its scroll position and keyboard focus. */
export function updatePanel() {
  const { self } = state;
  if (!openPanelId || !self) return;
  const panel = PANELS[openPanelId];
  const key = panel.key?.(self) ?? null;
  const old = element();
  if (old && key !== null && key === drawnKey) return;
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

function placeOf(panel: PanelId, map: MapId) {
  if (panel === 'grave') return state.entities.get('grave')?.entity;
  if (panel === 'trader') return traderInSight();
  return MAPS[map].stations.find(station => station.type === panel);
}

export function closePanelWhenFar() {
  const me = myTrack()?.entity;
  if (!openPanelId || ANYWHERE.includes(openPanelId) || !state.self || !me) return;
  const place = placeOf(openPanelId, state.self.map);
  if (!place || Math.max(Math.abs(me.x - place.x), Math.abs(me.y - place.y)) > STATION_REACH) closePanel();
}
