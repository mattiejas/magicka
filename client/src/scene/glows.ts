// The shine of glowing nodes: a warm shell around them, a ring on the ground and rising sparks.
import * as THREE from 'three';

const COLOR = '#ffd27a';
const SPARKS = 7;
const SPARK = new THREE.OctahedronGeometry(0.05);
const RING = new THREE.RingGeometry(0.62, 0.74, 24).rotateX(-Math.PI / 2);
const SHELL_SCALE = new THREE.Matrix4().makeScale(1.035, 1.02, 1.035);

const light = (opacity: number) =>
  new THREE.MeshBasicMaterial({
    color: COLOR,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
/** All glowing nodes pulse together. */
const SHELL_LIGHT = light(0.3);
const RING_LIGHT = light(0.7);
const SPARK_LIGHT = light(0.95);

interface Glow {
  root: THREE.Group;
  ring: THREE.Mesh;
  sparks: THREE.Mesh[];
}
interface Shape {
  whole: THREE.InstancedMesh;
  placement: THREE.Matrix4;
}

export class Glows {
  readonly group = new THREE.Group();
  private shown = new Map<string, Glow>();

  /** Makes exactly these nodes glow. */
  show(ids: Set<string>, shapeOf: (id: string) => Shape) {
    for (const [id, glow] of this.shown) {
      if (ids.has(id)) continue;
      this.group.remove(glow.root);
      this.shown.delete(id);
    }
    for (const id of ids) {
      if (this.shown.has(id)) continue;
      const glow = createGlow(shapeOf(id));
      this.shown.set(id, glow);
      this.group.add(glow.root);
    }
  }

  update(now: number) {
    const pulse = 0.5 + Math.sin(now / 260) * 0.5;
    SHELL_LIGHT.opacity = 0.28 + pulse * 0.22;
    for (const { ring, sparks } of this.shown.values()) {
      ring.scale.setScalar(0.95 + pulse * 0.12);
      for (const [i, spark] of sparks.entries()) {
        const rise = (now / 1500 + i / SPARKS) % 1;
        const angle = i * 2.4 + now / 1800;
        spark.position.set(Math.cos(angle) * 0.55, 0.2 + rise * 1.7, Math.sin(angle) * 0.55);
        spark.scale.setScalar(Math.sin(rise * Math.PI));
      }
    }
  }
}

function createGlow({ whole, placement }: Shape): Glow {
  const root = new THREE.Group();
  const shine = new THREE.Mesh(whole.geometry, SHELL_LIGHT);
  shine.matrixAutoUpdate = false;
  shine.matrix.copy(placement).multiply(SHELL_SCALE);
  const around = new THREE.Group();
  around.position.setFromMatrixPosition(placement);
  const ring = new THREE.Mesh(RING, RING_LIGHT);
  ring.position.y = 0.05;
  const sparks = Array.from({ length: SPARKS }, () => new THREE.Mesh(SPARK, SPARK_LIGHT));
  around.add(ring, ...sparks);
  root.add(shine, around);
  return { root, ring, sparks };
}
