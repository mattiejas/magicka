// Rings that spread over the water from fishing spots and fade.
import * as THREE from 'three';

const RINGS = 3;
const PERIOD_MS = 2400;
const RING = new THREE.RingGeometry(0.92, 1, 32).rotateX(-Math.PI / 2);
/** Above the surface, so that the waves of the water do not hide the rings. */
const LIFT = 0.04;

interface Ripple {
  root: THREE.Group;
  rings: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[];
  /** Spots do not ripple in step. */
  offset: number;
  size: number;
}

export class Ripples {
  readonly group = new THREE.Group();
  private shown = new Map<string, Ripple>();

  /** Lets exactly these spots ripple; `placementOf` gives where each is and how wide, in tiles. */
  show(ids: Set<string>, placementOf: (id: string) => { at: THREE.Vector3; size: number }) {
    for (const [id, ripple] of this.shown) {
      if (ids.has(id)) continue;
      this.group.remove(ripple.root);
      for (const ring of ripple.rings) ring.material.dispose();
      this.shown.delete(id);
    }
    for (const id of ids) {
      if (this.shown.has(id)) continue;
      const { at, size } = placementOf(id);
      const ripple = create(at, size, this.shown.size * 0.37);
      this.shown.set(id, ripple);
      this.group.add(ripple.root);
    }
  }

  /** `surface` is the height of the water now. */
  update(now: number, surface: number) {
    for (const { root, rings, offset, size } of this.shown.values()) {
      root.position.y = surface + LIFT;
      for (const [i, ring] of rings.entries()) {
        const age = (now / PERIOD_MS + offset + i / RINGS) % 1;
        ring.scale.setScalar((0.15 + age * 0.55) * size);
        ring.material.opacity = Math.sin(age * Math.PI) * 0.55;
      }
    }
  }
}

function create(at: THREE.Vector3, size: number, offset: number): Ripple {
  const root = new THREE.Group();
  root.position.copy(at);
  const rings = Array.from({ length: RINGS }, () => {
    const material = new THREE.MeshBasicMaterial({ color: '#f2fbfa', transparent: true, depthWrite: false });
    return new THREE.Mesh(RING, material);
  });
  root.add(...rings);
  return { root, rings, offset, size };
}
