// Text drawn over the world: names, health bars and damage numbers.
import { type Entity, MONSTERS, type TilePos } from '@driftwake/shared';
import { centreOf, state } from '../net/state';

export type Project = (x: number, z: number, height: number) => { x: number; y: number; visible: boolean };

interface Tag {
  element: HTMLElement;
  bar: HTMLElement;
  fill: HTMLElement;
}
interface FloatingText {
  element: HTMLElement;
  at: TilePos;
  height: number;
  startedAt: number;
}
const TEXT_MS = 1000;
const TEXT_RISE = 0.7;
const TAG_GAP = 0.25;

export class Overlay {
  private tags = new Map<string, Tag>();
  private texts: FloatingText[] = [];

  constructor(
    private root: HTMLElement,
    private project: Project,
    private heightOf: (id: string) => number,
  ) {}

  damage(target: string, at: TilePos, amount: number) {
    const kind = amount === 0 ? 'miss' : target === state.me ? 'me' : '';
    const element = document.createElement('div');
    element.className = `dmg ${kind}`;
    element.textContent = String(amount);
    this.root.append(element);
    this.texts.push({ element, at, height: this.heightOf(target) + 0.2, startedAt: performance.now() });
  }

  update(now: number) {
    for (const id of [...this.tags.keys()]) if (!state.entities.has(id)) this.removeTag(id);
    for (const track of state.entities.values()) {
      if (!hasTag(track.entity)) {
        this.removeTag(track.entity.id);
        continue;
      }
      this.updateTag(track.entity, centreOf(track));
    }
    this.texts = this.texts.filter(text => this.updateText(text, now));
  }

  private removeTag(id: string) {
    this.tags.get(id)?.element.remove();
    this.tags.delete(id);
  }

  private updateTag(entity: Entity, [x, z]: TilePos) {
    let tag = this.tags.get(entity.id);
    if (!tag) {
      tag = createTag(entity);
      this.root.append(tag.element);
      this.tags.set(entity.id, tag);
    }
    const screen = this.project(x, z, this.heightOf(entity.id) + TAG_GAP);
    tag.element.style.display = screen.visible ? '' : 'none';
    tag.element.style.transform = `translate(${screen.x | 0}px,${screen.y | 0}px) translate(-50%,-100%)`;
    tag.bar.style.visibility = isHurt(entity) ? '' : 'hidden';
    tag.fill.style.width = `${(100 * entity.hp!) / entity.maxHp!}%`;
  }

  /** Returns false once the text has faded out. */
  private updateText({ element, at, height, startedAt }: FloatingText, now: number): boolean {
    const progress = (now - startedAt) / TEXT_MS;
    if (progress >= 1) {
      element.remove();
      return false;
    }
    const screen = this.project(at[0], at[1], height + progress * TEXT_RISE);
    element.style.transform = `translate(${screen.x | 0}px,${screen.y | 0}px) translate(-50%,-50%)`;
    element.style.opacity = String(1 - progress * progress);
    return true;
  }
}

const isHurt = (entity: Entity) => entity.hp! < entity.maxHp!;
const hasTag = (entity: Entity) =>
  entity.kind === 'player' || (entity.kind === 'monster' && (isHurt(entity) || !!entity.boss));

function createTag(entity: Entity): Tag {
  const element = document.createElement('div');
  const name = document.createElement('span');
  const bar = document.createElement('b');
  const fill = document.createElement('i');
  element.className = 'tag';
  name.textContent = entity.kind === 'player' ? entity.name! : MONSTERS[entity.type!].name;
  bar.append(fill);
  element.append(name, bar);
  return { element, bar, fill };
}
