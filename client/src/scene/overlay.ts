// Text drawn over the world: names, health bars, damage numbers, XP, levels and chat.
import { type Entity, MONSTERS, type Skill, type TilePos } from '@driftwake/shared';
import { centreOf, state } from '../net/state';
import { DamageBar } from '../ui/damageBar';
import { uiScale } from '../ui/scale';
import { ChatLabels } from './chatLabels';
import { DropLabels } from './dropLabels';
import { LevelLabels, STACK_GAP_PX } from './levelLabels';
import { XpLabels } from './xpLabels';

export type Project = (x: number, z: number, height: number) => { x: number; y: number; visible: boolean };

interface Tag {
  element: HTMLElement;
  health: DamageBar;
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
  private dropLabels: DropLabels;
  private xpLabels: XpLabels;
  private levelLabels: LevelLabels;
  private project: Project;
  private chatLabels: ChatLabels;

  constructor(
    private root: HTMLElement,
    project: Project,
    private heightOf: (id: string) => number,
  ) {
    this.project = inScaledPixels(project);
    this.dropLabels = new DropLabels(root, this.project);
    this.xpLabels = new XpLabels(root, this.project, heightOf);
    // Above the head, from the bottom: your own XP gains, new levels, then chat.
    const xpBeneath = (player: string) => (player === state.me ? this.xpLabels.height : 0);
    this.levelLabels = new LevelLabels(root, this.project, heightOf, xpBeneath);
    this.chatLabels = new ChatLabels(root, this.project, heightOf, speaker =>
      stacked(xpBeneath(speaker), this.levelLabels.height(speaker)),
    );
  }

  levelUp(player: string, skill: Skill, level: number) {
    this.levelLabels.add(player, skill, level);
  }

  /** Shows a chat line above its speaker's head. */
  chat(speaker: string, text: string) {
    this.chatLabels.say(speaker, text);
  }

  /** Signing in again starts with nobody speaking or levelling. */
  forget() {
    this.chatLabels.forget();
    this.levelLabels.forget();
  }

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
    this.dropLabels.update();
    this.xpLabels.update(now);
    this.levelLabels.update(now);
    this.chatLabels.update(now);
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
    tag.health.track.style.visibility = isHurt(entity) ? '' : 'hidden';
    tag.health.set(entity.hp! / entity.maxHp!);
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

/**
 * The overlay is scaled with the interface (see `#overlay` in style.css), so everything in it is placed in
 * its own pixels: window pixels divided by the scale. Text added here is scaled by that alone.
 */
const inScaledPixels =
  (project: Project): Project =>
  (x, z, height) => {
    const screen = project(x, z, height);
    const scale = uiScale();
    return { ...screen, x: screen.x / scale, y: screen.y / scale };
  };

/** The height of two things one above the other, in pixels. */
const stacked = (lower: number, upper: number) =>
  lower && upper ? lower + STACK_GAP_PX + upper : lower + upper;

const isHurt = (entity: Entity) => entity.hp! < entity.maxHp!;
const hasTag = (entity: Entity) =>
  entity.kind === 'player' || (entity.kind === 'monster' && (isHurt(entity) || !!entity.boss));

function createTag(entity: Entity): Tag {
  const element = document.createElement('div');
  const name = document.createElement('span');
  const health = new DamageBar(document.createElement('b'), 'width');
  element.className = 'tag';
  name.textContent = entity.kind === 'player' ? entity.name! : MONSTERS[entity.type!].name;
  element.append(name, health.track);
  return { element, health };
}
