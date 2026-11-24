// Things lying on the ground: dropped items and graves.
import { ITEMS } from '@magicka/shared';
import * as THREE from 'three';
import { ball, blob, cyl, gem, lathe, merge, part, plate, rbox, shade, torus } from '../geo';
import { heldGeo, isHeld } from './held';
import { type Geometry, type Model, mesh, ring } from './model';

const STONE = '#9a978f';

const jewel = (color: string) => part(gem(0.15), color, [0, 0.17, 0]);

const SHAPES: Record<string, (color: string) => Geometry> = {
  log: c =>
    merge([
      part(cyl(0.11, 0.12, 0.6), c, [0, 0.12, 0], [0, 0.5, Math.PI / 2]),
      part(cyl(0.1, 0.1, 0.61), '#e0cca0', [0, 0.12, 0], [0, 0.5, Math.PI / 2], [0.8, 1, 0.8]),
    ]),
  ore: c =>
    merge([
      part(blob(0.18, 0.25, 3), '#837f78', [0, 0.13, 0]),
      ...ring(4).map(a => part(blob(0.06, 0.2, a), c, [Math.cos(a) * 0.13, 0.17, Math.sin(a) * 0.13])),
    ]),
  bar: c =>
    part(
      new THREE.CylinderGeometry(0.17, 0.24, 0.14, 4).rotateY(Math.PI / 4),
      c,
      [0, 0.08, 0],
      [0, 0.4, 0],
      [1.3, 1, 0.65],
    ),
  gem: jewel,
  essence: jewel,
  hide: c => part(blob(0.25, 0.25, 2), c, [0, 0.05, 0], [0, 0, 0], [1.1, 0.25, 0.9]),
  meat: c =>
    merge([
      part(blob(0.17, 0.15, 2), c, [0, 0.13, 0], [0, 0, 0], [1.3, 0.75, 0.9]),
      part(cyl(0.025, 0.025, 0.2), '#efe6d2', [0.24, 0.13, 0], [0, 0, Math.PI / 2]),
      part(ball(0.04), '#efe6d2', [0.34, 0.13, 0]),
    ]),
};

/** Anything without a shape of its own lies in a bag. */
const bag = (c: string) =>
  merge([
    part(blob(0.18, 0.08, 2), c, [0, 0.15, 0], [0, 0, 0], [1, 0.9, 1]),
    part(torus(0.07, 0.025), '#5a4632', [0, 0.3, 0], [Math.PI / 2, 0, 0]),
    part(
      lathe([
        [0.05, 0],
        [0.11, 0.1],
      ]),
      c,
      [0, 0.3, 0],
    ),
  ]);

function lyingDown(icon: string, color: string, unique?: boolean): Geometry {
  const geometry = heldGeo(icon, color, unique);
  return geometry
    .rotateX(Math.PI / 2)
    .rotateY(0.6)
    .translate(-0.15, 0.06, -0.2)
    .scale(0.8, 0.8, 0.8);
}

export function dropModel(itemId: string): Model {
  const { icon, color, unique } = ITEMS[itemId];
  const geometry = isHeld(icon) ? lyingDown(icon, color, unique) : (SHAPES[icon] ?? bag)(color);
  const root = new THREE.Group();
  root.add(mesh(geometry));
  if (unique) root.add(lightBeam(color));
  return { root, parts: {}, height: 0.4, kind: 'drop' };
}

function lightBeam(color: string): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 12), material);
  beam.position.y = 2;
  return beam;
}

export function graveModel(): Model {
  const root = new THREE.Group();
  root.add(
    mesh(
      merge([
        part(
          plate(
            q => {
              q.moveTo(-0.26, 0);
              q.lineTo(-0.26, 0.55);
              q.absarc(0, 0.55, 0.26, Math.PI, 0, true);
              q.lineTo(0.26, 0);
              q.closePath();
            },
            0.12,
            0.025,
          ),
          STONE,
        ),
        part(rbox(0.22, 0.04, 0.02, 0.01), shade(STONE, 0.7), [0, 0.52, 0.09]),
        part(rbox(0.04, 0.26, 0.02, 0.01), shade(STONE, 0.7), [0, 0.48, 0.09]),
        part(blob(0.42, 0.12, 2), '#6d5f48', [0, 0, 0.42], [0, 0, 0], [0.9, 0.28, 1.15]),
        ...ring(5).map((a, i) =>
          part(blob(0.07, 0.2, i), shade(STONE, 0.9), [Math.cos(a) * 0.38, 0.03, 0.42 + Math.sin(a) * 0.5]),
        ),
      ]),
    ),
  );
  return { root, parts: {}, height: 1, kind: 'grave' };
}
