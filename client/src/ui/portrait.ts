// Head-and-shoulders pictures for the hair picker, drawn once each by a small renderer of their own.
import type { Look } from '@driftwake/shared';
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

/** A data URL of a player's head with the given hair. */
export function portrait(name: string, look: Look): string {
  const key = `${name}:${look.cut}:${look.color}`;
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
