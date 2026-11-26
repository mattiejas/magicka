import type { Entity } from '@driftwake/shared';
import * as THREE from 'three';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAT } from '../geo';
import { monsterModel, playerModel, poseDeath } from '../models';
import { state } from '../net/state';
import { BOSS_DEATH_TIMING, DEATH_TIMING, DyingFigures, deathStage, HASTE_MS } from './dyingFigures';
import type { Effects } from './effects';
import { EntityLayer } from './entityLayer';
import { entityPicks } from './picking';

const end = ({ pose, lie, fade }: typeof DEATH_TIMING) => pose + lie + fade;

describe('deathStage', () => {
  it('takes the death pose, lies still, then fades out', () => {
    expect(deathStage(0, DEATH_TIMING)).toEqual({ pose: 0, opacity: 1, done: false });
    expect(deathStage(DEATH_TIMING.pose / 2, DEATH_TIMING).pose).toBeCloseTo(0.5);
    const lying = deathStage(DEATH_TIMING.pose + DEATH_TIMING.lie, DEATH_TIMING);
    expect(lying).toEqual({ pose: 1, opacity: 1, done: false });
    expect(deathStage(end(DEATH_TIMING) - DEATH_TIMING.fade / 2, DEATH_TIMING).opacity).toBeCloseTo(0.5);
    expect(deathStage(end(DEATH_TIMING), DEATH_TIMING).done).toBe(true);
  });

  it('gives a death pose of about a second, and bosses longer', () => {
    expect(DEATH_TIMING.pose).toBeGreaterThanOrEqual(800);
    expect(DEATH_TIMING.pose).toBeLessThanOrEqual(1200);
    expect(end(BOSS_DEATH_TIMING)).toBeGreaterThan(end(DEATH_TIMING));
  });

  it('fades out at once, from where it was, when the entity comes back beside it', () => {
    const at = 300;
    expect(deathStage(at + HASTE_MS / 2, DEATH_TIMING, at)).toMatchObject({ pose: at / DEATH_TIMING.pose });
    expect(deathStage(at + HASTE_MS / 2, DEATH_TIMING, at).opacity).toBeCloseTo(0.5);
    expect(deathStage(at + HASTE_MS, DEATH_TIMING, at).done).toBe(true);
  });
});

describe('death poses', () => {
  const heightOfTop = (root: THREE.Object3D) => new THREE.Box3().setFromObject(root).max.y;

  it('lays every monster shape and the player low, or takes it out of sight', () => {
    const models = [
      ['player', playerModel('Name', [null, null, null, null])],
      ...['wolf', 'chicken', 'wisp', 'spitter', 'golem', 'gnashclaw', 'deepstone', 'colossus'].map(
        id => [id, monsterModel(id)] as const,
      ),
    ] as const;
    for (const [id, model] of models) {
      const standing = heightOfTop(model.root);
      poseDeath(model, 1);
      if (id === 'wisp') continue; // dissolves instead, checked below
      expect(heightOfTop(model.root), id).toBeLessThan(standing * 0.8);
    }
  });

  it('keeps a fallen beast above the ground', () => {
    const model = monsterModel('wolf');
    poseDeath(model, 1);
    expect(new THREE.Box3().setFromObject(model.root).min.y).toBeGreaterThan(-0.15);
  });

  it('sinks Gnashclaw into the sand', () => {
    const model = monsterModel('gnashclaw');
    poseDeath(model, 1, true);
    expect(heightOfTop(model.root)).toBeLessThan(0.3);
  });

  it('flares a wisp out', () => {
    const model = monsterModel('wisp');
    const before = model.parts.body.scale.x;
    poseDeath(model, 1);
    expect(model.parts.body.scale.x).toBeGreaterThan(before);
  });
});

const monster = (id: string, x: number, y: number): Entity => ({ id, kind: 'monster', type: 'wolf', x, y });
const noEffects = { work() {} } as unknown as Effects;
const flatWorld = { heightAt: () => 0, centreOf: () => null, inSight: () => true } as never;

describe('EntityLayer', () => {
  let scene: THREE.Scene;
  let layer: EntityLayer;

  beforeEach(() => {
    state.entities.clear();
    scene = new THREE.Scene();
    layer = new EntityLayer(scene, noEffects);
  });

  const track = (entity: Entity) => {
    state.entities.set(entity.id, {
      entity,
      from: [entity.x, entity.y],
      path: [],
      movedAt: 0,
      sailedAt: 0,
      headingFrom: 0,
    });
  };

  it('keeps a monster that died where it fell, until it has faded', () => {
    track(monster('m1', 4, 6));
    layer.update(flatWorld, 0, 0.016);
    const centre = layer.centreOf('m1')!;
    state.entities.delete('m1');
    layer.die('m1', 0);
    layer.update(flatWorld, 500, 0.016);
    expect(scene.children).toHaveLength(1);
    expect(layer.centreOf('m1')).toEqual(centre);
    layer.update(flatWorld, end(DEATH_TIMING) + 1, 0.016);
    expect(scene.children).toHaveLength(0);
    expect(layer.centreOf('m1')).toBeNull();
  });

  it('shows a player who died falling where they stood, and in town at once', () => {
    const player: Entity = {
      id: 'p1',
      kind: 'player',
      name: 'Name',
      x: 30,
      y: 30,
      gear: [null, null, null, null],
      look: { cut: 0, color: 0 },
    };
    track(player);
    layer.update(flatWorld, 0, 0.016);
    track({ ...player, x: 2, y: 2 });
    layer.die('p1', 0);
    layer.update(flatWorld, 100, 0.016);
    expect(scene.children).toHaveLength(2);
    const positions = scene.children.map(child => [child.position.x, child.position.z]);
    expect(positions).toContainEqual([30.5, 30.5]);
    expect(positions).toContainEqual([2.5, 2.5]);
  });

  it('fades a dying monster at once when it comes back on the same spot', () => {
    track(monster('m1', 4, 6));
    layer.update(flatWorld, 0, 0.016);
    state.entities.delete('m1');
    layer.die('m1', 0);
    layer.update(flatWorld, 100, 0.016);
    track(monster('m1', 4, 6));
    layer.update(flatWorld, 200, 0.016);
    layer.update(flatWorld, 200 + HASTE_MS + 1, 0.016);
    expect(scene.children).toHaveLength(1);
  });

  it('leaves dying figures out of what can be clicked', () => {
    track(monster('m1', 4, 6));
    layer.update(flatWorld, 0, 0.016);
    state.entities.delete('m1');
    layer.die('m1', 0);
    expect(entityPicks({ size: 64 } as never, () => 1)).toHaveLength(0);
  });
});

it('fades a dying figure without fading the models still alive', () => {
  const scene = new THREE.Scene();
  const dying = new DyingFigures(scene);
  const model = monsterModel('wolf');
  scene.add(model.root);
  dying.add('m1', model, 0, false, 0);
  dying.update(end(DEATH_TIMING) - DEATH_TIMING.fade / 2, () => null);
  expect(MAT.opacity).toBe(1);
  let faded = 1;
  model.root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) faded = (mesh.material as THREE.Material).opacity;
  });
  expect(faded).toBeCloseTo(0.5);
});
