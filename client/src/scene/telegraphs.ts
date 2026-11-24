// Warnings on the ground before a boss attack lands. Timing follows the server's ticks, so what is seen is what hits.
import type { BossView, TilePos } from '@magicka/shared';
import * as THREE from 'three';
import { blob, MAT, merge, part, taper } from '../geo';

type State = BossView['state'];
/** Sets a telegraph to a moment: progress runs from 0 to 1 through the wind-up, then again through the execution. */
type Animate = (progress: number, state: State) => void;

export interface TelegraphSource {
  attack: string;
  tiles: TilePos[];
  /** Centre of the boss. */
  origin: TilePos;
  /** Hurled from the boss rather than falling from the sky. */
  thrown: boolean;
}

const TILE_COLORS: Record<string, string> = { vines: '#4f6b34', quake: '#7a4a30', boulder: '#2f2b2a' };

export class Telegraph {
  readonly group = new THREE.Group();
  readonly key: string;
  private animations: Animate[] = [];

  constructor(source: TelegraphSource) {
    this.key = telegraphKey(source.attack, source.tiles);
    this.markTiles(source);
    if (source.attack === 'boulder') this.boulders(source);
    else if (source.attack === 'vines') this.vines(source.tiles);
    else this.cracks(source.tiles);
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
  private boulders({ tiles, origin, thrown }: TelegraphSource) {
    for (const [x, y] of boulderCentres(tiles)) {
      const centre: TilePos = [x + 0.5, y + 0.5];
      this.boulderShadow(centre);
      this.boulder(centre, thrown ? origin : null);
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

  private boulder([x, z]: TilePos, thrownFrom: TilePos | null) {
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
      if (thrownFrom) {
        const [fromX, fromZ] = thrownFrom;
        rock.visible = t > 0.15;
        rock.position.set(fromX + (x - fromX) * t, 1 + Math.sin(t * 3.14) * 5, fromZ + (z - fromZ) * t);
      } else {
        const fall = Math.max(0, (t - 0.55) / 0.45);
        rock.visible = t > 0.55;
        rock.position.set(x, 0.5 + (1 - fall * fall) * 14, z);
      }
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

/** Identifies an attack, so that its telegraph is built once. Empty when there is nothing to show. */
export const telegraphKey = (attack: string | undefined, tiles: TilePos[]) =>
  tiles.length ? `${attack}:${JSON.stringify(tiles)}` : '';

/** A boulder covers three by three tiles: these are the tiles whose neighbours are all marked. */
function boulderCentres(tiles: TilePos[]): TilePos[] {
  const marked = new Set(tiles.map(tile => tile.join()));
  const around = [-1, 0, 1];
  const centres = tiles.filter(([x, y]) =>
    around.every(dx => around.every(dy => marked.has(`${x + dx},${y + dy}`))),
  );
  return centres.length ? centres : [tiles[Math.floor(tiles.length / 2)]];
}
