// Models of players, monsters, dropped items and graves, kept in step with the state.
import { type Entity, MONSTERS } from '@driftwake/shared';
import type * as THREE from 'three';
import {
  dropModel,
  graveModel,
  hasDeathPose,
  type Model,
  modelKey,
  monsterModel,
  npcModel,
  PoseBlend,
  playerModel,
  poseBoss,
  poseMonster,
  posePlayer,
} from '../models';
import {
  boatAt,
  centreOf,
  isMoving,
  positionOf,
  state,
  type Track,
  tickNow,
  walkDirection,
} from '../net/state';
import { DyingFigures } from './dyingFigures';
import type { Effects } from './effects';
import { aimOf, Telegraph, telegraphKey } from './telegraphs';
import { WATER_LEVEL, type WorldView } from './worldView';

/** How long an attack swing is shown. */
const ATTACK_MS = 550;
const TURN_SPEED = 14;
const DEFAULT_HEIGHT = 1.6;
/** How high a sailor stands above the water, on the bottom of the boat. */
const DECK_HEIGHT = 0.05;

interface Figure {
  model: Model;
  facing: number;
  blend: PoseBlend;
  boss: boolean;
}

export class EntityLayer {
  private figures = new Map<string, Figure>();
  private telegraphs = new Map<string, Telegraph>();
  private attackedAt = new Map<string, number>();
  private dying: DyingFigures;

  constructor(
    private scene: THREE.Scene,
    private effects: Effects,
  ) {
    this.dying = new DyingFigures(scene);
  }

  heightOf = (id: string, fallback = DEFAULT_HEIGHT) =>
    this.figures.get(id)?.model.height ?? this.dying.heightOf(id) ?? fallback;

  /** Where the figure of an entity stands, even one that just died, in world units. */
  centreOf(id: string): [number, number] | null {
    const figure = this.figures.get(id);
    if (figure) return [figure.model.root.position.x, figure.model.root.position.z];
    return this.dying.centreOf(id);
  }

  /**
   * The figure stays behind as a dying copy. The snapshot that tells of the death has already been
   * applied, so the entity may be gone from the state, or a player already in town; their next
   * figure is built from scratch.
   */
  die(id: string, now = performance.now()) {
    const figure = this.figures.get(id);
    if (!figure || !hasDeathPose(figure.model.kind)) return;
    this.figures.delete(id);
    this.attackedAt.delete(id);
    this.removeTelegraph(id);
    this.dying.add(id, figure.model, figure.facing, figure.boss, now);
  }

  noteAttack(id: string) {
    this.attackedAt.set(id, performance.now());
  }

  clear() {
    for (const id of [...this.figures.keys()]) this.remove(id);
    for (const id of [...this.telegraphs.keys()]) this.removeTelegraph(id);
    this.dying.clear();
  }

  update(world: WorldView, now: number, dt: number) {
    for (const id of [...this.figures.keys()]) if (!state.entities.has(id)) this.remove(id);
    for (const track of state.entities.values())
      if (track.entity.kind !== 'node') this.updateFigure(track, world, now, dt);
    for (const id of [...this.telegraphs.keys()])
      if (!state.entities.get(id)?.entity.boss) this.removeTelegraph(id);
    this.dying.update(now, id => {
      const root = this.figures.get(id)?.model.root;
      return root ? [root.position.x, root.position.z] : null;
    });
  }

  private remove(id: string) {
    const figure = this.figures.get(id);
    if (!figure) return;
    this.removeModel(figure.model);
    this.figures.delete(id);
    this.attackedAt.delete(id);
  }

  private removeModel({ root }: Model) {
    this.scene.remove(root);
    root.traverse(object => (object as THREE.Mesh).geometry?.dispose());
  }

  /** The entity's model, rebuilt when a player changes gear or hair. */
  private figureFor(entity: Entity): Figure {
    const existing = this.figures.get(entity.id);
    if (existing) {
      const outdated =
        entity.kind === 'player' && existing.model.key !== modelKey(entity.gear!, entity.look!);
      if (!outdated) return existing;
      this.removeModel(existing.model);
      existing.model = buildModel(entity);
      this.scene.add(existing.model.root);
      return existing;
    }
    const figure = { model: buildModel(entity), facing: 0, blend: new PoseBlend(), boss: isBoss(entity) };
    this.figures.set(entity.id, figure);
    this.scene.add(figure.model.root);
    return figure;
  }

  private updateFigure(track: Track, world: WorldView, now: number, dt: number) {
    const { entity } = track;
    const figure = this.figureFor(entity);
    const { root } = figure.model;
    const [x, z] = centreOf(track);
    const boat = entity.boat?.aboard ? boatAt(track) : null;
    root.position.set(
      x,
      boat ? WATER_LEVEL + DECK_HEIGHT : world.heightAt(x, z) + floatHeight(entity, now),
      z,
    );
    root.visible = entity.id === state.me || world.inSight(x, z);
    if (entity.kind !== 'player' && entity.kind !== 'monster') return;

    const moving = isMoving(track);
    // A sailor faces the bow. A heading is clockwise from north, a figure's facing from south.
    const wanted = boat
      ? Math.PI - (boat.heading * Math.PI) / 180
      : moving
        ? walkingAngle(track)
        : targetAngle(entity, root.position, world);
    if (wanted !== null) figure.facing = turnTowards(figure.facing, wanted, dt);
    root.rotation.y = figure.facing;

    const sinceAttack = now - (this.attackedAt.get(entity.id) ?? Number.NEGATIVE_INFINITY);
    const hit = Math.max(0, 1 - sinceAttack / ATTACK_MS);
    const pose = {
      // A figure still finishing its last step does no work, but lands the blow it walked up to make.
      action: moving && !hit ? undefined : entity.action,
      walk: now / 105,
      moving,
      hit,
      time: now,
      tool: entity.tool,
    };
    if (entity.kind === 'player') {
      posePlayer(figure.model, pose, figure.blend);
      this.effects.work(entity, figure.facing, now);
    } else if (entity.boss) this.updateBoss(track, figure.model);
    else poseMonster(figure.model, { ...pose, phase: positionOf(track)[0] });
  }

  private updateBoss(track: Track, model: Model) {
    const boss = track.entity.boss!;
    const duration = Math.max(1, boss.end - boss.start);
    const progress = boss.state === 'choose' ? 0 : Math.min(1, (tickNow() - boss.start) / duration);
    poseBoss(model, boss, progress);

    const { id } = track.entity;
    const key = telegraphKey(id, boss);
    if (this.telegraphs.get(id)?.key !== key) this.removeTelegraph(id);
    if (key && !this.telegraphs.has(id)) {
      const telegraph = new Telegraph({
        attack: boss.attack!,
        tiles: boss.tiles,
        centres: boss.centres,
        key,
        origin: centreOf(track),
      });
      this.telegraphs.set(id, telegraph);
      this.scene.add(telegraph.group);
    }
    this.telegraphs.get(id)?.update(progress, boss.state);
  }

  private removeTelegraph(id: string) {
    const telegraph = this.telegraphs.get(id);
    if (!telegraph) return;
    this.scene.remove(telegraph.group);
    this.telegraphs.delete(id);
  }
}

const isBoss = ({ kind, type }: Entity) => kind === 'monster' && !!MONSTERS[type!]?.boss;

function floatHeight({ kind, type }: Entity, now: number): number {
  if (kind === 'drop') return 0.04 + Math.sin(now / 500) * 0.04;
  return type === 'genie' ? 0.15 + Math.sin(now / 600) * 0.1 : 0;
}

function buildModel(entity: Entity): Model {
  switch (entity.kind) {
    case 'player':
      return playerModel(entity.name!, entity.gear!, entity.look!);
    case 'monster':
      return monsterModel(entity.type!);
    case 'npc':
      return npcModel(entity.type!);
    case 'drop':
      return dropModel(entity.type!);
    default:
      return graveModel();
  }
}

function walkingAngle(track: Track): number | null {
  const direction = walkDirection(track);
  return direction && Math.atan2(direction[0], direction[1]);
}

/** Towards whatever the entity is working on or fighting. An idle boss looks at you. */
function targetAngle(entity: Entity, position: THREE.Vector3, world: WorldView): number | null {
  const aim = entity.boss && aimOf(entity.boss);
  if (aim) return Math.atan2(aim[0] - position.x, aim[1] - position.z);
  const targetId = entity.boss?.target ?? entity.target ?? (entity.boss ? state.me : undefined);
  if (!targetId) return null;
  const centre = targetCentre(targetId, world);
  if (!centre) return null;
  const dx = centre[0] - position.x;
  const dz = centre[1] - position.z;
  return Math.hypot(dx, dz) > 0.1 ? Math.atan2(dx, dz) : null;
}

function targetCentre(id: string, world: WorldView): [number, number] | null {
  const track = state.entities.get(id);
  if (track && track.entity.kind !== 'node') return centreOf(track);
  return world.centreOf(id);
}

function turnTowards(from: number, to: number, dt: number): number {
  const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + difference * (1 - Math.exp(-dt * TURN_SPEED));
}
