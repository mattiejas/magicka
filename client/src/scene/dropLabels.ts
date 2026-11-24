// Names above items on the ground, with the time until they disappear.
import { type Entity, ITEMS, TICK_MS } from '@driftwake/shared';
import { state, tickNow } from '../net/state';
import type { Project } from './overlay';

const LABEL_HEIGHT = 0.55;
/** Kinds of items named on one tile; the rest is only counted. */
const MAX_LINES = 5;
const HURRY_SECONDS = 15;

interface Pile {
  item: string;
  qty: number;
  until: number;
}
interface Label {
  element: HTMLElement;
  text: string;
}

export class DropLabels {
  private labels = new Map<string, Label>();

  constructor(
    private root: HTMLElement,
    private project: Project,
  ) {}

  update() {
    const tiles = Map.groupBy(drops(), ({ x, y }) => `${x},${y}`);
    for (const [tile, { element }] of this.labels) {
      if (tiles.has(tile)) continue;
      element.remove();
      this.labels.delete(tile);
    }
    for (const [tile, lying] of tiles) this.updateLabel(tile, lying);
  }

  private updateLabel(tile: string, lying: Entity[]) {
    let label = this.labels.get(tile);
    if (!label) {
      const element = document.createElement('div');
      element.className = 'drop-label';
      label = { element, text: '' };
      this.labels.set(tile, label);
      this.root.append(element);
    }
    const screen = this.project(lying[0].x + 0.5, lying[0].y + 0.5, LABEL_HEIGHT);
    label.element.style.display = screen.visible ? '' : 'none';
    label.element.style.transform = `translate(${screen.x | 0}px,${screen.y | 0}px) translate(-50%,-100%)`;
    const lines = linesFor(piles(lying));
    const text = JSON.stringify(lines);
    if (text === label.text) return;
    label.text = text;
    label.element.replaceChildren(...lines.map(drawLine));
  }
}

const drops = () => [...state.entities.values()].map(track => track.entity).filter(e => e.kind === 'drop');

/** Items of a kind are one pile, which shows the time of whatever goes first. The most valuable comes first. */
function piles(lying: Entity[]): Pile[] {
  const byItem = new Map<string, Pile>();
  for (const { type, qty = 1, until = 0 } of lying) {
    const pile = byItem.get(type!);
    if (!pile) byItem.set(type!, { item: type!, qty, until });
    else {
      pile.qty += qty;
      pile.until = Math.min(pile.until, until);
    }
  }
  const worth = ({ item, qty }: Pile) => (ITEMS[item].unique ? 1e9 : 0) + ITEMS[item].value * qty;
  return [...byItem.values()].sort((a, b) => worth(b) - worth(a));
}

interface Line {
  name: string;
  time: string;
  className: string;
}

function linesFor(all: Pile[]): Line[] {
  const lines = all.slice(0, MAX_LINES).map(({ item, qty, until }) => {
    const seconds = Math.max(0, Math.ceil(((until - tickNow()) * TICK_MS) / 1000));
    const { name, unique } = ITEMS[item];
    return {
      name: qty > 1 ? `${name} (${qty.toLocaleString('en')})` : name,
      time: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      className: [unique && 'unique', seconds <= HURRY_SECONDS && 'hurry'].filter(Boolean).join(' '),
    };
  });
  const hidden = all.length - lines.length;
  return hidden ? [...lines, { name: `and ${hidden} more`, time: '', className: '' }] : lines;
}

function drawLine({ name, time, className }: Line): HTMLElement {
  const line = document.createElement('div');
  const timer = document.createElement('i');
  line.className = className;
  timer.textContent = time;
  line.append(name, timer);
  return line;
}
