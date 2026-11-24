// Mouse and keyboard.
import { MAPS, type TilePos, walkable } from '@driftwake/shared';
import { send } from './net/connection';
import { state } from './net/state';
import type { Scene } from './scene/scene';
import { mainAction, type Option, optionsFor, type Thing } from './things';
import { focusChat } from './ui/chat';
import { closePanel } from './ui/panels';
import { playerMenu } from './ui/players';
import { closeMenu, hideTooltip, showMenu, showTooltip } from './ui/popups';
import { isSettingsOpen } from './ui/settingsModal';

const MIDDLE_BUTTON = 1;
const LEFT_BUTTON = 0;

/** The main action of the nearest thing that has one. */
function firstAction(things: Thing[]): Option | null {
  for (const thing of things) {
    const action = mainAction(thing, { send });
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
    const action = firstAction(hits);
    if (action) action[1]();
    else walkTo(scene, tile);
  });
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
    const { hits, tile } = scene.pick(event.clientX, event.clientY);
    const place = { x: event.clientX, y: event.clientY };
    const playerOptions = (name: string, id: string) => playerMenu(name, id, place);
    const items = hits.flatMap(thing => optionsFor(thing, { send, playerOptions }));
    if (tile) items.push(['Walk here', () => walkTo(scene, tile)]);
    showMenu(event.clientX, event.clientY, items);
  });
}

function bindHover(canvas: HTMLCanvasElement, scene: Scene) {
  canvas.addEventListener('mousemove', event => {
    const { hits, tile } = scene.pick(event.clientX, event.clientY);
    const action = firstAction(hits);
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
  canvas.addEventListener('mousedown', event => {
    if (event.button !== MIDDLE_BUTTON) return;
    last = [event.clientX, event.clientY];
    event.preventDefault();
  });
  addEventListener('mousemove', event => {
    if (!last) return;
    scene.rig.rotate((last[0] - event.clientX) * 0.006, (event.clientY - last[1]) * 0.005);
    last = [event.clientX, event.clientY];
  });
  addEventListener('mouseup', () => {
    last = null;
  });
  canvas.addEventListener(
    'wheel',
    event => {
      event.preventDefault();
      scene.rig.zoom(Math.exp(event.deltaY * 0.001));
    },
    { passive: false },
  );
}

function bindKeys(scene: Scene): (dt: number) => void {
  const held = new Set<string>();
  addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || isSettingsOpen()) return;
    held.add(event.key);
    if (event.key === 'Escape') {
      closeMenu();
      closePanel();
    }
    if (event.key === 'Enter' && state.me) {
      focusChat();
      event.preventDefault();
    }
  });
  addEventListener('keyup', event => held.delete(event.key));
  addEventListener('blur', () => held.clear());
  const axis = (negative: string, positive: string) =>
    Number(held.has(positive)) - Number(held.has(negative));
  return dt => scene.rig.rotate(axis('ArrowLeft', 'ArrowRight') * dt * 2, axis('ArrowDown', 'ArrowUp') * dt);
}
