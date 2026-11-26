// Players and monsters that just died: the figure stays where it fell, takes its death pose, lies still
// a moment and fades away. It is not in the state, so nothing can click, pick or label it.
import * as THREE from 'three';
import { type Model, poseDeath } from '../models';

export interface DeathTiming {
  /** How long the death pose takes, then how long the figure lies still and fades, in milliseconds. */
  pose: number;
  lie: number;
  fade: number;
}

export const DEATH_TIMING: DeathTiming = { pose: 1000, lie: 400, fade: 600 };
export const BOSS_DEATH_TIMING: DeathTiming = { pose: 2200, lie: 700, fade: 1100 };
/** A dying figure fades this fast once the same entity is back next to it, so the two never stand together. */
export const HASTE_MS = 250;
/** How near, in tiles, the returned entity has to be to hasten the fade. */
export const OVERLAP_RANGE = 2.5;

export interface DeathStage {
  /** How far through the death pose, from 0 to 1. */
  pose: number;
  opacity: number;
  done: boolean;
}

/** Where a dying figure is, `elapsed` ms after death. `hastenedAt` is when its entity came back close by. */
export function deathStage(elapsed: number, timing: DeathTiming, hastenedAt = Infinity): DeathStage {
  const clamp = (t: number) => Math.min(1, Math.max(0, t));
  const pose = clamp(Math.min(elapsed, hastenedAt) / timing.pose);
  const fading = 1 - clamp((elapsed - timing.pose - timing.lie) / timing.fade);
  const hastened = 1 - clamp((elapsed - hastenedAt) / HASTE_MS);
  const opacity = Math.min(fading, hastened);
  return { pose, opacity, done: opacity <= 0 };
}

interface Dying {
  id: string;
  model: Model;
  holder: THREE.Group;
  materials: THREE.Material[];
  timing: DeathTiming;
  boss: boolean;
  diedAt: number;
  hastenedAt: number;
}

/** Where an entity is now, in world units, or null when it is not in view. */
export type LiveCentre = (id: string) => [number, number] | null;

export class DyingFigures {
  private dying: Dying[] = [];

  constructor(private scene: THREE.Scene) {}

  get count() {
    return this.dying.length;
  }

  /** Takes over a model that stood in the world, facing `facing`. */
  add(id: string, model: Model, facing: number, boss: boolean, now: number) {
    const { root } = model;
    const holder = new THREE.Group();
    holder.position.copy(root.position);
    holder.rotation.y = facing;
    this.scene.remove(root);
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    holder.add(root);
    this.scene.add(holder);
    const materials = fadeable(root);
    const timing = boss ? BOSS_DEATH_TIMING : DEATH_TIMING;
    this.dying.push({ id, model, holder, materials, timing, boss, diedAt: now, hastenedAt: Infinity });
  }

  update(now: number, liveCentre: LiveCentre) {
    this.dying = this.dying.filter(figure => {
      const elapsed = now - figure.diedAt;
      if (figure.hastenedAt === Infinity && this.isCrowded(figure, liveCentre)) figure.hastenedAt = elapsed;
      const stage = deathStage(elapsed, figure.timing, figure.hastenedAt);
      if (stage.done) {
        this.remove(figure);
        return false;
      }
      poseDeath(figure.model, stage.pose, figure.boss);
      for (const material of figure.materials) material.opacity = stage.opacity;
      figure.holder.traverse(object => {
        if ((object as THREE.Mesh).isMesh) object.castShadow = stage.opacity > 0.5;
      });
      return true;
    });
  }

  centreOf(id: string): [number, number] | null {
    const figure = this.latest(id);
    return figure ? [figure.holder.position.x, figure.holder.position.z] : null;
  }

  heightOf(id: string): number | undefined {
    return this.latest(id)?.model.height;
  }

  clear() {
    for (const figure of this.dying) this.remove(figure);
    this.dying = [];
  }

  private latest(id: string) {
    return this.dying.findLast(figure => figure.id === id);
  }

  private isCrowded({ id, holder }: Dying, liveCentre: LiveCentre): boolean {
    const live = liveCentre(id);
    if (!live) return false;
    return Math.hypot(live[0] - holder.position.x, live[1] - holder.position.z) < OVERLAP_RANGE;
  }

  private remove({ holder, materials }: Dying) {
    this.scene.remove(holder);
    holder.traverse(object => (object as THREE.Mesh).geometry?.dispose());
    for (const material of materials) material.dispose();
  }
}

/** Gives the model its own copies of its materials, so that it can fade without fading anything else. */
function fadeable(root: THREE.Object3D): THREE.Material[] {
  const copies = new Map<THREE.Material, THREE.Material>();
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    let copy = copies.get(mesh.material);
    if (!copy) {
      copy = mesh.material.clone();
      copy.transparent = true;
      copies.set(mesh.material, copy);
    }
    mesh.material = copy;
  });
  return [...copies.values()];
}
