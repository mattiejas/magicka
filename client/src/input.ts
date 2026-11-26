// Mouse and keyboard.
import { MAPS, type TilePos, walkable } from '@driftwake/shared';
import { boardOption, helmKeyDown, helmKeyUp, isAboard, letGo, steer } from './helm';
import { send } from './net/connection';
import { state } from './net/state';
import type { Scene } from './scene/scene';
import { clickAction, type Option, optionsForAll, type Thing } from './things';
import { focusChat } from './ui/chat';
import { byId } from './ui/dom';
import { closePanel } from './ui/panels';
import { playerMenu } from './ui/players';
import { closeMenu, hideTooltip, showMenu, showTooltip } from './ui/popups';
import { isSettingsOpen } from './ui/settingsModal';

const MIDDLE_BUTTON = 1;
const LEFT_BUTTON = 0;

/** True while Alt is held to show every ground label. */
let revealLabels = false;
export const revealAllLabels = () => revealLabels;

/** What clicking the nearest thing that does something does. */
function firstAction(things: Thing[]): Option | null {
  for (const thing of things) {
    const action = clickAction(thing, { send });
    if (action) return action;
  }
  return null;
}

/** Starts listening. Call the returned function every frame with the seconds passed. */
export function bindInput(canvas: HTMLCanvasElement, scene: Scene): (dt: number) => void {
  bindClicks(canvas, scene);
  bindHover(canvas, scene);
  bindCameraDrag(canvas, scene);
  return bindKeys(scene);
}

function walkTo(scene: Scene, tile: TilePos | null) {
  if (!tile || !state.self) return;
  if (walkable(MAPS[state.self.map], ...tile)) scene.showDestination(tile);
  send({ type: 'move', x: tile[0], y: tile[1] });
}

function bindClicks(canvas: HTMLCanvasElement, scene: Scene) {
  canvas.addEventListener('mousedown', event => {
    closeMenu();
    (document.activeElement as HTMLElement | null)?.blur();
    if (event.button !== LEFT_BUTTON) return;
    closePanel();
    const { hits, tile } = scene.pick(event.clientX, event.clientY);
    if (isAboard()) {
      if (tile) steer(tile);
      return;
    }
    const action = firstAction(hits) ?? boardOption(tile);
    if (action) action[1]();
    else walkTo(scene, tile);
  });
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
    const { hits, tile } = scene.pick(event.clientX, event.clientY);
    const place = { x: event.clientX, y: event.clientY };
    const playerOptions = (name: string, id: string) => playerMenu(name, id, place);
    const items = optionsForAll(hits, { send, playerOptions });
    const board = boardOption(tile);
    if (board) items.unshift(board);
    if (tile && isAboard()) items.unshift(['Steer here', () => steer(tile)]);
    else if (tile) items.push(['Walk here', () => walkTo(scene, tile)]);
    showMenu(event.clientX, event.clientY, items);
  });
}

function bindHover(canvas: HTMLCanvasElement, scene: Scene) {
  canvas.addEventListener('mousemove', event => {
    const { hits, tile } = scene.pick(event.clientX, event.clientY);
    const action = isAboard() ? null : (firstAction(hits) ?? boardOption(tile));
    scene.showHover(action ? null : tile);
    canvas.style.cursor = action ? 'pointer' : 'default';
    showTooltip(action?.[0] ?? '', event.clientX, event.clientY);
  });
  canvas.addEventListener('mouseleave', () => {
    scene.showHover(null);
    hideTooltip();
  });
}

function bindCameraDrag(canvas: HTMLCanvasElement, scene: Scene) {
  let last: TilePos | null = null;
  const startDrag = (event: MouseEvent) => {
    if (event.button !== MIDDLE_BUTTON) return;
    last = [event.clientX, event.clientY];
    event.preventDefault();
  };
  const zoom = (event: WheelEvent) => {
    event.preventDefault();
    scene.rig.zoom(Math.exp(event.deltaY * 0.001));
  };
  canvas.addEventListener('mousedown', startDrag);
  canvas.addEventListener('wheel', zoom, { passive: false });
  // Labels sit above the canvas; wheel and middle-drag must still reach the camera.
  const overlay = byId('overlay');
  overlay?.addEventListener('mousedown', startDrag);
  overlay?.addEventListener('wheel', zoom, { passive: false });
  addEventListener('mousemove', event => {
    if (!last) return;
    scene.rig.rotate((last[0] - event.clientX) * 0.006, (event.clientY - last[1]) * 0.005);
    last = [event.clientX, event.clientY];
  });
  addEventListener('mouseup', () => {
    last = null;
  });
}

function typing(): boolean {
  const target = document.activeElement;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || isSettingsOpen();
}

function bindKeys(scene: Scene): (dt: number) => void {
  const held = new Set<string>();
  addEventListener('keydown', event => {
    if (typing()) return;
    if (helmKeyDown(event)) {
      event.preventDefault();
      return;
    }
    held.add(event.key);
    if (event.key === 'Alt') {
      revealLabels = true;
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      closeMenu();
      closePanel();
    }
    // Enter on a focused button presses it; anywhere else it opens the chat.
    if (event.key === 'Enter' && state.me && !(document.activeElement instanceof HTMLButtonElement)) {
      focusChat();
      event.preventDefault();
    }
  });
  addEventListener('keyup', event => {
    helmKeyUp(event);
    held.delete(event.key);
    if (event.key === 'Alt') revealLabels = false;
  });
  addEventListener('blur', () => {
    letGo();
    held.clear();
    revealLabels = false;
  });
  const axis = (negative: string, positive: string) =>
    Number(held.has(positive)) - Number(held.has(negative));
  return dt => scene.rig.rotate(axis('ArrowLeft', 'ArrowRight') * dt * 2, axis('ArrowDown', 'ArrowUp') * dt);
}
