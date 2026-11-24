// People and spirits who visit: the stranded trader and the genie.
import * as THREE from 'three';
import { ball, cyl, gem, lathe, merge, part, rbox, shade, taper, torus } from '../geo';
import { posePlayer } from './animation';
import { type Model, mesh, SIDES } from './model';
import { eyes } from './monsters/parts';
import { playerModel } from './player';

const GOLD = '#d9b25b';
const SPIRIT = '#5fa8b8';

export const npcModel = (kind: string): Model => (kind === 'genie' ? genie() : trader());

function trader(): Model {
  const model = playerModel('Stranded', [null, 'leather_cowl_2', 'cloth_robe_1', 'leather_chaps_1']);
  posePlayer(model, { moving: false, walk: 0, hit: 0, time: 0 });
  const pack = mesh(
    merge([
      part(rbox(0.36, 0.44, 0.24, 0.05), '#7b5f42', [0, 1.2, -0.25]),
      part(cyl(0.1, 0.1, 0.5, 8), '#a8584a', [0, 1.5, -0.25], [0, 0, Math.PI / 2]),
      part(rbox(0.34, 0.3, 0.3, 0.03), '#8a6b48', [0.62, 0.15, 0.1], [0, 0.4, 0]),
      part(rbox(0.28, 0.24, 0.28, 0.03), '#96754f', [0.6, 0.42, 0.08], [0, 0.1, 0]),
    ]),
  );
  model.root.add(pack);
  return { ...model, kind: 'npc' };
}

function genie(): Model {
  const root = new THREE.Group();
  root.add(
    mesh(
      merge([
        part(
          lathe([
            [0.02, 0],
            [0.09, 0.2],
            [0.24, 0.5],
            [0.3, 0.8],
            [0.26, 1.05],
            [0.1, 1.2],
          ]),
          SPIRIT,
        ),
        part(torus(0.27, 0.045), GOLD, [0, 0.72, 0], [Math.PI / 2, 0, 0]),
        part(ball(0.2, true), shade(SPIRIT, 1.15), [0, 1.36, 0]),
        part(ball(0.2, true), '#e8dcc4', [0, 1.5, -0.02], [0, 0, 0], [1.1, 0.65, 1.1]),
        part(gem(0.06), '#c0483c', [0, 1.55, 0.19]),
        part(
          taper(
            [
              [0, 1.28, 0.16],
              [0, 1.16, 0.2],
              [0, 1.05, 0.17],
            ],
            0.06,
            0.01,
          ),
          '#33404a',
        ),
        ...eyes(0.075, 1.4, 0.16, 0.03),
        ...SIDES.flatMap(side => [
          part(
            taper(
              [
                [side * 0.24, 1.08, 0],
                [side * 0.42, 0.92, 0.1],
                [side * 0.06, 0.88, 0.3],
              ],
              0.085,
              0.06,
            ),
            shade(SPIRIT, 1.08),
          ),
          part(torus(0.07, 0.022), GOLD, [side * 0.2, 0.89, 0.26], [0, Math.PI / 2, 0]),
        ]),
      ]),
    ),
  );
  root.rotation.y = 0.3;
  return { root, parts: {}, height: 1.8, kind: 'npc' };
}
