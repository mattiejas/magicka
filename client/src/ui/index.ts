// The interface: lays out the panels and keeps them in step with the server's messages.
import type { ServerMsg } from '@driftwake/shared';
import { hasSession, onClosed, onMessage, resume } from '../net/connection';
import { state } from '../net/state';
import { updateBosses } from './bosses';
import { chatBox, showChat, showInfo, showTradeRequest } from './chat';
import { h, uiRoot } from './dom';
import { fpsCounter } from './fpsCounter';
import { updateHint } from './hints';
import { isLoginShown, loginError, showLogin, showLoginError, takeJustRegistered } from './login';
import { drawMinimap, minimapPanel } from './minimap';
import { closePanel, closePanelWhenFar, isPanelId, openPanel, showTrade, updatePanel } from './panels';
import { warmPortraits } from './portrait';
import { sidebar, updateSidebar } from './sidebar';
import { updateVitals } from './vitals';
import { showXp } from './xpGains';
import './style.css';

/** The minimap and timers do not need every frame. */
const REDRAW_MS = 60;

/** Starts the interface. Call the returned function every frame. */
export function initUi(): (now: number) => void {
  onMessage(handleMessage);
  onClosed(handleClosed);
  showLogin();
  if (hasSession()) resume();
  const updateFps = fpsCounter();
  let drawnAt = 0;
  return now => {
    updateFps(now);
    if (now - drawnAt < REDRAW_MS) return;
    drawnAt = now;
    drawMinimap();
    updateBosses();
  };
}

function showGame() {
  closePanel();
  uiRoot().replaceChildren(
    h('div', { id: 'vitals', class: 'panel' }),
    h(
      'div',
      { id: 'top' },
      h('div', { id: 'hint', class: 'panel', hidden: true }),
      h('div', { id: 'boss', class: 'panel', hidden: true }),
    ),
    minimapPanel(),
    sidebar(),
    chatBox(),
    h('div', { id: 'drops' }),
  );
}

function handleMessage(msg: ServerMsg) {
  switch (msg.type) {
    case 'welcome':
      return showGame();
    case 'error':
      return isLoginShown() ? showLoginError(msg.text) : showLogin(msg.text);
    case 'kicked':
      return showLogin(msg.text);
    case 'self':
      updateSidebar();
      updatePanel();
      updateHint();
      if (state.self) warmPortraits(state.self.name);
      if (takeJustRegistered()) openPanel('hair');
      return;
    case 'snapshot':
      updateVitals();
      updateHint();
      updateBosses();
      if (state.trade) showTrade();
      closePanelWhenFar();
      return updatePanel();
    case 'chat':
      return showChat(msg.from, msg.text);
    case 'info':
      return showInfo(msg.text, msg.kind);
    case 'xp':
      return showXp(msg.skill, msg.amount);
    case 'tradeRequest':
      return showTradeRequest(msg.id, msg.name);
    case 'trade':
      return showTrade();
    case 'fees':
      return updatePanel();
    case 'open':
      if (isPanelId(msg.station)) openPanel(msg.station);
      return;
  }
}

function handleClosed(reason: string) {
  if (reason) showInfo(reason, 'bad');
  else if (!isLoginShown()) showLogin('Disconnected.');
  else if (!loginError()) showLoginError('Could not reach the server.');
}
