// Warnings on the ground before a boss attack lands. Timing follows the server's ticks, so what is seen is what hits.
import type { BossView, TilePos } from '@driftwake/shared';
import * as THREE from 'three';
import { blob, MAT, merge, part, taper } from '../geo';

type State = BossView['state'];
/** Sets a telegraph to a moment: progress runs from 0 to 1 through the wind-up, then again through the execution. */
type Animate = (progress: number, state: State) => void;

export interface TelegraphSource {
  attack: string;
  tiles: TilePos[];
  /** Where each boulder, claw or jet is aimed, as the server aimed it. */
  centres: TilePos[];
  /** Identifies the attack, see telegraphKey. */
  key: string;
  /** Centre of the boss. */
  origin: TilePos;
}

const TILE_COLORS: Record<string, string> = {
  vines: '#4f6b34',
  quake: '#7a4a30',
  boulder: '#2f2b2a',
  snap: '#8a2c1c',
  double_snap: '#8a2c1c',
  jet: '#1f5f96',
};
/** A jet leaves the mouth this far from the middle of the boss, and this high. */
const MOUTH = { distance: 0.95, height: 0.55 };
const JET_DROPS = 36;
const JET_SPREAD = 0.07;
/** The share of the wind-up at which water leaves the mouth, to arrive when the attack lands. */
const JET_LEAVES = 0.8;

export class Telegraph {
  readonly group = new THREE.Group();
  readonly key: string;
  private animations: Animate[] = [];

  constructor(source: TelegraphSource) {
    this.key = source.key;
    this.markTiles(source);
    if (source.attack === 'boulder') this.boulders(source);
    else if (source.attack === 'vines') this.vines(source.tiles);
    else if (source.attack === 'quake') this.cracks(source.tiles);
    else if (source.attack === 'jet') this.jet(source);
  }

  update(progress: number, state: State) {
    for (const animate of this.animations) animate(progress, state);
  }

  private markTiles({ attack, tiles }: TelegraphSource) {
    const material = new THREE.MeshBasicMaterial({
      color: TILE_COLORS[attack] ?? TILE_COLORS.boulder,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const square = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(square, material, tiles.length);
    tiles.forEach(([x, y], i) => {
      mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x + 0.5, 0.035, y + 0.5));
    });
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.animations.push((t, state) => {
      material.opacity = state === 'windup' ? 0.12 + t * 0.33 : 0.5 * (1 - t);
    });
  }

  /** A shadow that grows and darkens until a boulder lands in it. */
  private boulders({ centres }: TelegraphSource) {
    for (const [x, y] of centres) {
      const centre: TilePos = [x + 0.5, y + 0.5];
      this.boulderShadow(centre);
      this.boulder(centre);
    }
  }

  private boulderShadow([x, z]: TilePos) {
    const material = new THREE.MeshBasicMaterial({ color: '#201d1c', transparent: true, depthWrite: false });
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.45, 20).rotateX(-Math.PI / 2), material);
    shadow.position.set(x, 0.045, z);
    this.group.add(shadow);
    this.animations.push((t, state) => {
      const falling = state === 'windup';
      shadow.scale.setScalar(falling ? 0.15 + t * 0.85 : 1);
      material.opacity = falling ? 0.15 + t * 0.5 : 0.5 * (1 - t);
    });
  }

  private boulder([x, z]: TilePos) {
    const rock = new THREE.Mesh(
      merge([part(blob(0.95, 0.18, 3), '#8a857e'), part(blob(0.3, 0.2, 5), '#7a756e', [0.7, 0.3, 0.3])]),
      MAT,
    );
    rock.castShadow = true;
    this.group.add(rock);
    this.animations.push((t, state) => {
      if (state !== 'windup') {
        rock.visible = true;
        rock.position.set(x, 0.35 - t * 1.3, z);
        return;
      }
      rock.rotation.x = t * 5;
      const fall = Math.max(0, (t - 0.55) / 0.45);
      rock.visible = t > 0.55;
      rock.position.set(x, 0.5 + (1 - fall * fall) * 14, z);
    });
  }

  /** Sprouts that grow, then whip shut. */
  private vines(tiles: TilePos[]) {
    for (const [x, y] of tiles)
      for (let i = 0; i < 4; i++) {
        const angle = i * 1.57 + x;
        const curve = taper(
          [
            [0, 0, 0],
            [0.06, 0.35, 0.03],
            [-0.04, 0.7, 0],
            [0.05, 1, 0.04],
          ],
          0.075,
          0.01,
        );
        const vine = new THREE.Mesh(part(curve, '#5f7f3a'), MAT);
        vine.position.set(x + 0.5 + Math.cos(angle) * 0.26, 0, y + 0.5 + Math.sin(angle) * 0.26);
        vine.castShadow = true;
        this.group.add(vine);
        this.animations.push((t, state) => {
          const growing = state === 'windup';
          vine.scale.y = growing ? 0.08 + t * 0.45 : 1.5 * (1 - t * 0.8);
          const lean = growing ? Math.sin(performance.now() / 200 + angle) * 0.15 : 0.7;
          vine.rotation.set(-Math.sin(angle) * lean, 0, Math.cos(angle) * lean);
        });
      }
  }

  /** Water that shoots from the mouth of the boss to where it is aimed. */
  private jet({ centres: [[tileX, tileY]], origin: [fromX, fromZ] }: TelegraphSource) {
    const [toX, toZ] = [tileX + 0.5, tileY + 0.5];
    const length = Math.hypot(toX - fromX, toZ - fromZ) || 1;
    const [mouthX, mouthZ] = [toX - fromX, toZ - fromZ].map(
      d => (d / length) * Math.min(MOUTH.distance, length),
    );
    const material = new THREE.MeshStandardMaterial({ color: '#9fd3ee', transparent: true, opacity: 0.85 });
    const water = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 1), material, JET_DROPS);
    water.frustumCulled = false;
    this.group.add(water);
    const at = new THREE.Matrix4();
    this.animations.push((t, state) => {
      const front = state === 'windup' ? Math.max(0, (t - JET_LEAVES) / (1 - JET_LEAVES)) : 1;
      const back = state === 'windup' ? 0 : Math.min(1, t * 2);
      const flow = (performance.now() / 300) % 1;
      for (let i = 0; i < JET_DROPS; i++) {
        const along = (i + flow) / JET_DROPS;
        const size = along <= front && along >= back ? 0.5 + along * 0.7 + (i % 3) * 0.15 : 0;
        at.makeScale(size, size, size).setPosition(
          fromX + mouthX + (toX - fromX - mouthX) * along + Math.sin(i * 2.4) * JET_SPREAD,
          MOUTH.height + Math.sin(along * Math.PI) * 0.35 - (MOUTH.height - 0.1) * along * along,
          fromZ + mouthZ + (toZ - fromZ - mouthZ) * along + Math.cos(i * 2.4) * JET_SPREAD,
        );
        water.setMatrixAt(i, at);
      }
      water.instanceMatrix.needsUpdate = true;
    });
  }

  /** Stones that tremble, then burst out of the ground. */
  private cracks(tiles: TilePos[]) {
    for (const [x, y] of tiles) {
      const shape = part(blob(0.32, 0.25, x + y), '#75644c', [0, 0, 0], [0.2, x + y, 0.3], [1, 1.1, 0.6]);
      const stone = new THREE.Mesh(shape, MAT);
      stone.position.set(x + 0.5, -0.4, y + 0.5);
      this.group.add(stone);
      this.animations.push((t, state) => {
        const tremble = Math.sin(performance.now() / 40 + x) * 0.02 * t;
        stone.position.y = state === 'windup' ? -0.34 + t * 0.14 + tremble : 0.25 - t * 0.8;
      });
    }
  }
}

/**
 * Identifies an attack, so that its telegraph is built once: the boss and the tick at which the attack lands, which is
 * where the wind-up ends and the execution begins. Empty when there is nothing to show.
 */
export const telegraphKey = (bossId: string, boss: BossView) =>
  boss.state === 'choose' || !boss.tiles.length
    ? ''
    : `${bossId}:${boss.state === 'windup' ? boss.end : boss.start}`;

const AIMED = ['snap', 'double_snap', 'jet'];

/** The point a boss faces during such an attack: between where it is aimed. Others follow their target. */
export function aimOf({ state, attack, centres }: BossView): TilePos | null {
  if (state === 'choose' || !centres.length || !AIMED.includes(attack!)) return null;
  const mean = (axis: 0 | 1) => centres.reduce((sum, at) => sum + at[axis] + 0.5, 0) / centres.length;
  return [mean(0), mean(1)];
}
