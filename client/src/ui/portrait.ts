// Head-and-shoulders pictures for the hair picker, drawn once each by a small renderer of their own.
import { HAIR_COLORS, HAIRCUTS, type Look } from '@driftwake/shared';
import * as THREE from 'three';
import { playerModel, posePlayer } from '../models';

const SIZE = 176;
const pictures = new Map<string, string>();

interface Studio {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}
let studio: Studio | null = null;

/** One name at a time; a second call for the same name is ignored. */
let warming: string | null = null;

function createStudio(): Studio {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  const sun = new THREE.DirectionalLight('#fff0d6', 2.6);
  sun.position.set(3, 4, 5);
  const scene = new THREE.Scene();
  scene.add(sun, new THREE.HemisphereLight('#fff6ee', '#d0b8a4', 2));
  const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 10);
  camera.position.set(0, 1.74, 1.35);
  camera.lookAt(0, 1.66, 0);
  return { renderer, scene, camera };
}

const keyOf = (name: string, look: Look) => `${name}:${look.cut}:${look.color}`;

/** A data URL of a player's head with the given hair. */
export function portrait(name: string, look: Look): string {
  const key = keyOf(name, look);
  const known = pictures.get(key);
  if (known) return known;
  studio ??= createStudio();
  const { root, ...model } = playerModel(name, [null, null, null, null], look);
  posePlayer({ root, ...model }, { moving: false, walk: 0, hit: 0, time: 0 });
  root.rotation.y = 0.5;
  studio.scene.add(root);
  studio.renderer.render(studio.scene, studio.camera);
  studio.scene.remove(root);
  root.traverse(object => {
    (object as THREE.Mesh).geometry?.dispose();
  });
  const picture = studio.renderer.domElement.toDataURL('image/png');
  pictures.set(key, picture);
  return picture;
}

/**
 * Builds every cut and colour for this player in the background, so opening the
 * hair picker does not stall a frame on the first model builds.
 */
export function warmPortraits(name: string) {
  if (warming === name) return;
  warming = name;
  const jobs: Look[] = [];
  for (let cut = 0; cut < HAIRCUTS.length; cut++) {
    for (let color = 0; color < HAIR_COLORS.length; color++) {
      if (!pictures.has(keyOf(name, { cut, color }))) jobs.push({ cut, color });
    }
  }
  const next = () => {
    if (warming !== name) return;
    const look = jobs.shift();
    if (!look) {
      warming = null;
      return;
    }
    portrait(name, look);
    schedule(next);
  };
  if (jobs.length) schedule(next);
  else warming = null;
}

function schedule(work: () => void) {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
    .requestIdleCallback;
  if (idle) idle(work, { timeout: 120 });
  else requestAnimationFrame(work);
}
