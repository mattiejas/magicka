// Head-and-shoulders pictures for the hair picker, drawn once by a small renderer of their own.

import type { Look } from '@magicka/shared';
import * as THREE from 'three';
import { playerModel, posePlayer } from './models';

const SIZE = 176,
  cache = new Map<string, string>();
let gl: { r: THREE.WebGLRenderer; s: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;
export function portrait(name: string, look: Look): string {
  const key = `${name}:${look.cut}:${look.color}`,
    hit = cache.get(key);
  if (hit) return hit;
  if (!gl) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(SIZE, SIZE, false);
    r.toneMapping = THREE.NeutralToneMapping;
    const s = new THREE.Scene(),
      sun = new THREE.DirectionalLight('#fff0d6', 2.6);
    sun.position.set(3, 4, 5);
    s.add(sun, new THREE.HemisphereLight('#fff6ee', '#d0b8a4', 2));
    const cam = new THREE.PerspectiveCamera(22, 1, 0.1, 10);
    cam.position.set(0, 1.74, 1.35);
    cam.lookAt(0, 1.66, 0);
    gl = { r, s, cam };
  }
  const m = playerModel(name, [null, null, null, null], look);
  posePlayer(m, { moving: false, walk: 0, hit: 0, t: 0 });
  m.root.rotation.y = 0.5;
  gl.s.add(m.root);
  gl.r.render(gl.s, gl.cam);
  gl.s.remove(m.root);
  m.root.traverse(o => (o as THREE.Mesh).geometry?.dispose());
  const url = gl.r.domElement.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
