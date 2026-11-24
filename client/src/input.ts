// Mouse and keyboard.
import { MAPS, MONSTERS, NODES, type TilePos, walkable } from '@driftwake/shared';
import { send } from './net/connection';
import { state } from './net/state';
import type { Pick } from './scene/picking';
import type { Scene } from './scene/scene';
import { focusChat } from './ui/chat';
import { closePanel } from './ui/panels';
import { closeMenu, hideTooltip, type MenuItem, showMenu, showTooltip } from './ui/popups';

const MIDDLE_BUTTON = 1;
const LEFT_BUTTON = 0;
const GATHER_VERBS = { rock: 'Mine', tree: 'Chop', plant: 'Pick' };

/** What clicking a thing does. */
interface Interaction {
  verb: string;
  run: () => void;
}

function interactionWith({ kind, id, type, entity }: Pick): Interaction | null {
  if (kind === 'node')
    return { verb: GATHER_VERBS[NODES[type].kind], run: () => send({ type: 'gather', id }) };
  if (kind === 'station') return { verb: 'Use', run: () => send({ type: 'station', id }) };
  switch (entity!.kind) {
    case 'monster':
      return { verb: 'Attack', run: () => send({ type: 'attack', id }) };
    case 'drop':
      return { verb: 'Take', run: () => send({ type: 'pickup', id }) };
    case 'grave':
      return { verb: 'Recover', run: () => send({ type: 'grave' }) };
    default:
      return null;
  }
}

/** Name and, where it matters, level. */
function label({ kind, name, type, entity }: Pick): string {
  if (entity?.kind === 'monster') return `${name}  level ${MONSTERS[type].level}`;
  if (kind === 'node' && NODES[type].skill) return `${name}  ${NODES[type].skill} ${NODES[type].level}`;
  return name;
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
    const interaction = hits.map(interactionWith).find(Boolean);
    if (interaction) interaction.run();
    else walkTo(scene, tile);
  });
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
    const { hits, tile } = scene.pick(event.clientX, event.clientY);
    const items = hits.flatMap((pick): MenuItem[] => {
      const interaction = interactionWith(pick);
      return interaction ? [[`${interaction.verb} ${label(pick)}`, interaction.run]] : [];
    });
    if (tile) items.push(['Walk here', () => walkTo(scene, tile)]);
    showMenu(event.clientX, event.clientY, items);
  });
}

function bindHover(canvas: HTMLCanvasElement, scene: Scene) {
  canvas.addEventListener('mousemove', event => {
    const { hits, tile } = scene.pick(event.clientX, event.clientY);
    const pick = hits.find(interactionWith);
    scene.showHover(pick ? null : tile);
    canvas.style.cursor = pick ? 'pointer' : 'default';
    const text = pick ? `${interactionWith(pick)!.verb} ${label(pick)}` : '';
    showTooltip(text, event.clientX, event.clientY);
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
    if (event.target instanceof HTMLInputElement) return;
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
