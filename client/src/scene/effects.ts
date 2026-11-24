// Short-lived visuals: projectiles, debris from tools, and the dust of boss impacts.
import type { Entity, GameEvent, TilePos } from '@driftwake/shared';
import * as THREE from 'three';
import { STRIKE_AT, workCycleMs } from '../models';

interface Effect {
  mesh: THREE.Mesh;
  startedAt: number;
  durationMs: number;
  /** Progress runs from 0 to 1. */
  animate: (mesh: THREE.Mesh, progress: number) => void;
}

export const PROJECTILE_MS = 280;
const CHIP = new THREE.IcosahedronGeometry(0.055, 0);
const BOLT = new THREE.OctahedronGeometry(0.16);
const ARROW = new THREE.BoxGeometry(0.05, 0.05, 0.5);
const CHIPS_PER_STRIKE = 7;
/** How far in front of a worker the tool lands. */
const REACH = 0.62;

interface Debris {
  color: string;
  glow: string;
  height: number;
  scale: number;
}
const DEBRIS: Record<string, Debris> = {
  mine: { color: '#8f8a82', glow: '#000000', height: 0.6, scale: 1 },
  chop: { color: '#d0b183', glow: '#000000', height: 0.6, scale: 1 },
  craft: { color: '#f0b060', glow: '#b06020', height: 0.85, scale: 0.5 },
};

export class Effects {
  private active: Effect[] = [];
  /** Number of the last strike seen, per worker. */
  private strikes = new Map<string, number>();

  constructor(private scene: THREE.Scene) {}

  update(now: number) {
    this.active = this.active.filter(effect => {
      const progress = (now - effect.startedAt) / effect.durationMs;
      if (progress < 1) {
        effect.animate(effect.mesh, progress);
        return true;
      }
      this.scene.remove(effect.mesh);
      (effect.mesh.material as THREE.Material).dispose();
      return false;
    });
  }

  projectile(from: TilePos, to: TilePos, style: string) {
    const isMagic = style === 'magic';
    const material = new THREE.MeshBasicMaterial({ color: isMagic ? '#a9d0ea' : '#e5d9bd' });
    this.play(new THREE.Mesh(isMagic ? BOLT : ARROW, material), PROJECTILE_MS, (mesh, t) => {
      const arc = 1 + Math.sin(t * 3.14) * 0.3;
      mesh.position.set(from[0] + (to[0] - from[0]) * t, arc, from[1] + (to[1] - from[1]) * t);
      mesh.lookAt(to[0], 1, to[1]);
    });
  }

  impact({ attack, tiles }: Extract<GameEvent, { type: 'impact' }>) {
    const color = attack === 'vines' ? '#6f9048' : '#9a8f7c';
    for (const [x, y] of tiles) {
      if ((x + y) % 2) continue; // half the tiles is plenty
      const angle = Math.random() * 6;
      const mesh = new THREE.Mesh(CHIP, new THREE.MeshStandardMaterial({ color }));
      this.play(mesh, 500, (m, t) => {
        m.position.set(
          x + 0.5 + Math.cos(angle) * t,
          Math.sin(t * 3.14) * 1.1,
          y + 0.5 + Math.sin(angle) * t,
        );
        m.scale.setScalar(1 - t);
      });
    }
  }

  /** Throws debris at the moment a worker's tool lands. */
  work(worker: Entity, facing: number, now: number) {
    const debris = DEBRIS[worker.action ?? ''];
    if (!debris) return;
    const strike = Math.floor(now / workCycleMs(worker.action!) - STRIKE_AT);
    const previous = this.strikes.get(worker.id);
    this.strikes.set(worker.id, strike);
    const landed = previous !== undefined && previous !== strike;
    if (!landed || (!worker.target && worker.action !== 'craft')) return;
    const x = worker.x + 0.5 + Math.sin(facing) * REACH;
    const z = worker.y + 0.5 + Math.cos(facing) * REACH;
    for (let i = 0; i < CHIPS_PER_STRIKE; i++) this.chip(x, z, debris);
  }

  private chip(x: number, z: number, { color, glow, height, scale }: Debris) {
    const angle = Math.random() * 6.28;
    const speed = 0.25 + Math.random() * 0.4;
    const lift = 0.4 + Math.random() * 0.5;
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, emissive: glow });
    this.play(new THREE.Mesh(CHIP, material), 450 + Math.random() * 200, (mesh, t) => {
      const y = Math.max(0.03, height + lift * t * 1.6 - 2 * t * t);
      mesh.position.set(x + Math.cos(angle) * speed * t, y, z + Math.sin(angle) * speed * t);
      mesh.rotation.set(t * 9, t * 7, 0);
      mesh.scale.setScalar((1 - t * 0.6) * scale);
    });
  }

  private play(mesh: THREE.Mesh, durationMs: number, animate: Effect['animate']) {
    animate(mesh, 0);
    this.scene.add(mesh);
    this.active.push({ mesh, durationMs, animate, startedAt: performance.now() });
  }
}
