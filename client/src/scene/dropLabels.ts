// Names above items on the ground: which to show, where they sit, and how they are drawn.
import { type Entity, ITEMS } from '@driftwake/shared';
import { revealAllLabels } from '../input';
import { send } from '../net/connection';
import { myTrack, positionOf, state, tickNow } from '../net/state';
import { settings } from '../settings';
import { mainAction, optionsForAll, type Thing } from '../things';
import { takeIconUrl } from '../ui/icons/take';
import { playerMenu } from '../ui/players';
import { closeMenu, hideTooltip, showMenu, showTooltip } from '../ui/popups';
import { pileName, type Timer, timerFor } from './dropTimer';
import type { Project } from './overlay';

const LABEL_HEIGHT = 0.55;
/** Kinds of items named on one tile; the rest is only counted. */
const MAX_LINES = 5;
const GAP = 2;

interface Pile {
  item: string;
  qty: number;
  until: number;
  publicAt: number;
  id: string;
}

interface Line {
  name: string;
  /** Absent for the "and N more" row. */
  timer?: Timer;
  className: string;
  /** Drop to take; absent for the "and N more" row. */
  id?: string;
}

interface Label {
  element: HTMLElement;
  text: string;
}

interface Placement {
  tile: string;
  x: number;
  y: number;
  lines: Line[];
  label: Label;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

export class DropLabels {
  private labels = new Map<string, Label>();

  constructor(
    private root: HTMLElement,
    private project: Project,
  ) {}

  update() {
    const chosen = chooseTiles(drops());
    for (const [tile, { element }] of this.labels) {
      if (chosen.has(tile)) continue;
      element.remove();
      this.labels.delete(tile);
    }
    const placements: Placement[] = [];
    for (const [tile, { x, y, lines }] of chosen) {
      const label = this.ensureLabel(tile);
      const screen = this.project(x + 0.5, y + 0.5, LABEL_HEIGHT);
      if (!screen.visible) {
        label.element.style.display = 'none';
        continue;
      }
      label.element.style.display = '';
      const text = JSON.stringify(lines);
      if (text !== label.text) {
        label.text = text;
        label.element.replaceChildren(...lines.map(drawLine));
      }
      placements.push({
        tile,
        x,
        y,
        lines,
        label,
        anchorX: screen.x,
        anchorY: screen.y,
        width: label.element.offsetWidth,
        height: label.element.offsetHeight,
      });
    }
    placeLabels(placements);
    for (const p of placements) {
      p.label.element.style.transform = `translate(${p.anchorX | 0}px,${p.anchorY | 0}px) translate(-50%,-100%)`;
    }
  }

  private ensureLabel(tile: string): Label {
    let label = this.labels.get(tile);
    if (label) return label;
    const element = document.createElement('div');
    element.className = 'drop-label';
    label = { element, text: '' };
    this.labels.set(tile, label);
    this.root.append(element);
    return label;
  }
}

const drops = () => [...state.entities.values()].map(track => track.entity).filter(e => e.kind === 'drop');

/** Piles that pass the player's filter, limited to the lines a tile may show. */
function chooseTiles(lying: Entity[]): Map<string, { x: number; y: number; lines: Line[] }> {
  const byTile = Map.groupBy(lying, ({ x, y }) => `${x},${y}`);
  const out = new Map<string, { x: number; y: number; lines: Line[] }>();
  for (const [tile, onTile] of byTile) {
    const lines = linesFor(filterPiles(piles(onTile)));
    if (!lines.length) continue;
    out.set(tile, { x: onTile[0].x, y: onTile[0].y, lines });
  }
  return out;
}

/** Items of a kind are one pile, timed by whatever leaves soonest. The most valuable comes first. */
function piles(lying: Entity[]): Pile[] {
  const byItem = new Map<string, Pile>();
  for (const drop of lying) {
    const item = drop.type!;
    const qty = drop.qty ?? 1;
    const until = drop.until ?? 0;
    const publicAt = drop.publicAt ?? 0;
    const pile = byItem.get(item);
    if (!pile) {
      byItem.set(item, { item, qty, until, publicAt, id: drop.id });
      continue;
    }
    pile.qty += qty;
    if (until < pile.until) {
      pile.until = until;
      pile.publicAt = publicAt;
      pile.id = drop.id;
    }
  }
  const worth = ({ item, qty }: Pile) => (ITEMS[item].unique ? 1e9 : 0) + ITEMS[item].value * qty;
  return [...byItem.values()].sort((a, b) => worth(b) - worth(a));
}

function filterPiles(all: Pile[]): Pile[] {
  if (revealAllLabels() || settings().labelMode === 'all') return all;
  if (settings().labelMode === 'none') return [];
  const threshold = settings().labelThreshold;
  return all.filter(({ item, qty }) => ITEMS[item].unique || ITEMS[item].value * qty >= threshold);
}

function linesFor(all: Pile[]): Line[] {
  const lines = all.slice(0, MAX_LINES).map(pile => {
    const { name, unique } = ITEMS[pile.item];
    const timer = timerFor(!!unique, pile.until, pile.publicAt, tickNow());
    return {
      name: pileName(name, pile.qty),
      timer,
      className: [unique && 'unique', timer.hurry && 'hurry'].filter(Boolean).join(' '),
      id: pile.id,
    };
  });
  const hidden = all.length - lines.length;
  return hidden ? [...lines, { name: `and ${hidden} more`, className: '' }] : lines;
}

/** Nearest labels first; push later ones up in screen space until they are free. Ties break by tile. */
function placeLabels(placements: Placement[]) {
  const self = myTrack();
  const [cx, cy] = self ? positionOf(self) : [0, 0];
  const dist = (p: Placement) => (p.x + 0.5 - cx) ** 2 + (p.y + 0.5 - cy) ** 2;
  placements.sort((a, b) => dist(a) - dist(b) || a.tile.localeCompare(b.tile));
  const placed: Placement[] = [];
  for (const next of placements) {
    for (;;) {
      const hit = placed.find(p => overlaps(next, p));
      if (!hit) break;
      next.anchorY = hit.anchorY - hit.height - GAP;
    }
    placed.push(next);
  }
}

function overlaps(a: Placement, b: Placement): boolean {
  const aLeft = a.anchorX - a.width / 2;
  const aRight = a.anchorX + a.width / 2;
  const aTop = a.anchorY - a.height;
  const aBottom = a.anchorY;
  const bLeft = b.anchorX - b.width / 2;
  const bRight = b.anchorX + b.width / 2;
  const bTop = b.anchorY - b.height;
  const bBottom = b.anchorY;
  return aLeft < bRight + GAP && aRight + GAP > bLeft && aTop < bBottom + GAP && aBottom + GAP > bTop;
}

function drawLine(line: Line): HTMLElement {
  const row = document.createElement('div');
  row.className = line.className;
  row.append(line.name);
  if (line.timer) row.append(drawTimer(line.timer));
  if (!line.id) return row;
  row.classList.add('take');
  const thingOf = (): Thing | null => {
    const entity = state.entities.get(line.id!)?.entity;
    return entity ? { kind: 'entity', entity } : null;
  };
  row.addEventListener('mousedown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    closeMenu();
    hideTooltip();
    const thing = thingOf();
    if (thing) mainAction(thing, { send })?.[1]();
  });
  row.addEventListener('contextmenu', event => {
    event.preventDefault();
    const thing = thingOf();
    if (!thing) return;
    const place = { x: event.clientX, y: event.clientY };
    showMenu(
      event.clientX,
      event.clientY,
      optionsForAll([thing], { send, playerOptions: (name, id) => playerMenu(name, id, place) }),
    );
  });
  row.addEventListener('mousemove', event => {
    const thing = thingOf();
    showTooltip(thing ? (mainAction(thing, { send })?.[0] ?? '') : '', event.clientX, event.clientY);
  });
  row.addEventListener('mouseleave', () => hideTooltip());
  return row;
}

/** The icon of who may take the pile, then the time left. Hovering the icon says what it means. */
function drawTimer({ icon, meaning, time }: Timer): HTMLElement {
  const timer = document.createElement('i');
  const image = document.createElement('img');
  image.src = takeIconUrl(icon);
  image.alt = meaning;
  image.draggable = false;
  image.addEventListener('mousemove', event => {
    event.stopPropagation();
    showTooltip(meaning, event.clientX, event.clientY);
  });
  timer.append(image, time);
  return timer;
}
