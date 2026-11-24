// Geometry helpers for a chunky, faceted look: few large faces, flat normals, one baked colour per face.
// Callers pass the detail they would like; the helpers cap it so the whole game shares one style.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Four light steps instead of a smooth falloff.
const STEPS = new THREE.DataTexture(new Uint8Array([120, 175, 225, 255].flatMap(v => [v, v, v, 255])), 4, 1); STEPS.needsUpdate = true;
export const MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: STEPS });
/** Ink line: a slightly inflated copy drawn inside out. Works for instanced meshes too. */
const INK = new THREE.MeshBasicMaterial({ color: '#2b2438', side: THREE.BackSide });
INK.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 inkNormal;').replace('#include <begin_vertex>', 'vec3 transformed = position + inkNormal * 0.014;'); };
/** Adds normals averaged across shared corners, so the inflated copy has no gaps at hard edges. */
function inkNormals(g: THREE.BufferGeometry) {
  if (g.attributes.inkNormal) return;
  const p = g.attributes.position, n = g.attributes.normal, sum = new Map<string, THREE.Vector3>(), key = (i: number) => `${Math.round(p.getX(i) * 500)},${Math.round(p.getY(i) * 500)},${Math.round(p.getZ(i) * 500)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i); let v = sum.get(k); if (!v) sum.set(k, (v = new THREE.Vector3())); v.x += n.getX(i); v.y += n.getY(i); v.z += n.getZ(i); }
  for (const v of sum.values()) v.normalize();
  const a = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) sum.get(key(i))!.clone().multiplyScalar(g.attributes.ink?.getX(i) ?? 1).toArray(a, i * 3);
  g.setAttribute('inkNormal', new THREE.BufferAttribute(a, 3));
}
export function outline<M extends THREE.Mesh>(m: M): M {
  inkNormals(m.geometry); let o: THREE.Mesh;
  if (m instanceof THREE.InstancedMesh) { const i = new THREE.InstancedMesh(m.geometry, INK, m.count); i.instanceMatrix = m.instanceMatrix; i.frustumCulled = false; o = i; } else o = new THREE.Mesh(m.geometry, INK);
  m.add(o); return m;
}
export type V3 = [number, number, number];
type G = THREE.BufferGeometry;
export function part(g: G, color: string, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): G {
  const o = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k);
  o.deleteAttribute('normal'); // rebuilt below; non-indexed, so every face is flat
  o.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale)));
  o.computeVertexNormals();
  o.computeBoundingBox(); const y0 = o.boundingBox!.min.y, hh = Math.max(0.001, o.boundingBox!.max.y - y0);
  const p = o.attributes.position, c = new THREE.Color(color), a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, k = 1 + noise(x * 11, y * 11, z * 11) * 0.06, up = o.attributes.normal.getY(i);
    // Painted light: faces looking up drift warm, faces looking down drift violet.
    const f = c.clone().multiplyScalar(k); if (up > 0) f.lerp(WARM, up * 0.14); else f.lerp(COOL, -up * 0.3);
    f.lerp(COOL, 0.22 * (1 - (y - y0) / hh) ** 2);
    for (let j = 0; j < 3; j++) f.toArray(a, (i + j) * 3);
  }
  // Small details get a thinner line or none, so it never swallows them.
  const size = o.boundingBox!.getSize(new THREE.Vector3()), big = Math.max(size.x, size.y, size.z), ink = big < 0.14 ? 0 : big < 0.32 ? 0.6 : 1;
  o.setAttribute('ink', new THREE.BufferAttribute(new Float32Array(p.count).fill(ink), 1));
  o.setAttribute('color', new THREE.BufferAttribute(a, 3)); return o;
}
const WARM = new THREE.Color('#ffe2a0'), COOL = new THREE.Color('#4a3a78');
/** Bends a whole shape sideways as it rises. */
export function bend(g: THREE.BufferGeometry, amt: number, freq = 1.1) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * freq) * amt * Math.min(1, y)); p.setZ(i, p.getZ(i) + Math.sin(y * freq * 0.7 + 1) * amt * 0.5 * Math.min(1, y)); } g.computeVertexNormals(); return g; }
export const merge = (l: G[]) => mergeGeometries(l)!;
export const shade = (c: string, k: number) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
/** Smooth pseudo-noise in -1..1. */
export const noise = (x: number, y: number, z: number) => (Math.sin(x * 1.7 + y * 2.3 + 1.1) + Math.sin(y * 1.9 - z * 2.7 + 2.3) + Math.sin(z * 1.3 + x * 2.9 + 4.2)) / 3;
export const rbox = (w: number, h: number, d: number, r = 0.05, _s?: number): G => (Math.min(w, h, d) < 0.08 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, Math.min(r, Math.min(w, h, d) * 0.25)));
export const ball = (r: number, d = 14): G => new THREE.SphereGeometry(r, r < 0.06 ? 5 : d >= 18 ? 8 : 6, r < 0.06 ? 3 : d >= 18 ? 5 : 4);
export const cyl = (a: number, b: number, h: number, s = 7): G => new THREE.CylinderGeometry(a, b, h, Math.min(s, 7));
export const cone = (r: number, h: number, s = 6): G => new THREE.ConeGeometry(r, h, Math.min(s, 5));
export const capsule = (r: number, len: number): G => new THREE.CapsuleGeometry(r, len, 2, 6);
/** Surface of revolution from [radius, y] pairs. */
export const lathe = (pts: [number, number][], seg = 8): G => {
  // Profiles may be listed in either direction; wind them so faces always point outwards.
  const loop: [number, number][] = [...pts, [0, pts.at(-1)![1]], [0, pts[0][1]]], area = loop.reduce((t, [r, y], i) => { const [r2, y2] = loop[(i + 1) % loop.length]; return t + r * y2 - r2 * y; }, 0);
  if (area < 0) pts = [...pts].reverse();
  return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(0.001, p[0]), p[1])), seg >= 30 ? 11 : Math.min(seg, 8));
};
/** Organic lump. `rough` distorts it; `facet` keeps crisp stone-like faces. */
export function blob(r: number, _detail = 3, rough = 0.15, seed = 0, _facet = false): G {
  const g = new THREE.IcosahedronGeometry(r, r < 0.16 ? 0 : r < 0.9 ? 1 : 2), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const k = 1 + rough * (noise(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed) + 0.5 * noise(v.x * 5 - seed, v.y * 5 + seed, v.z * 5)); v.multiplyScalar(r * k); p.setXYZ(i, v.x, v.y, v.z); }
  return g;
}
/** Tapered tube along a curve: radius goes from r0 to r1. */
export function taper(pts: V3[], r0: number, r1: number, seg = 14, rad = 10): G {
  seg = Math.min(seg, Math.max(2, (pts.length - 1) * 2)); rad = r0 > 0.22 ? 7 : Math.min(rad, 5);
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), g = new THREE.TubeGeometry(c, seg, 1, rad), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) { const o = c.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg); for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(p, k).sub(o).multiplyScalar(r).add(o); p.setXYZ(k, v.x, v.y, v.z); } }
  g.deleteAttribute('uv'); return g;
}
/** Bevelled plate cut from a 2D outline, centred in depth. */
export function plate(draw: (s: THREE.Shape) => void, depth: number, bevel = 0.015): G {
  const s = new THREE.Shape(); draw(s); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 3 }); g.translate(0, 0, -depth / 2); return g;
}
export const torus = (r: number, t: number, arc = Math.PI * 2): G => new THREE.TorusGeometry(r, t, 4, r > 0.3 ? 11 : 8, arc);
export const gem = (r: number): G => new THREE.OctahedronGeometry(r, 0);
export const crystal = (r: number, h: number): G => { const g = new THREE.CylinderGeometry(r * 0.75, r, h * 0.7, 6).toNonIndexed(); const t = new THREE.ConeGeometry(r * 0.75, h * 0.3, 6).toNonIndexed(); t.translate(0, h * 0.5, 0); g.deleteAttribute('uv'); t.deleteAttribute('uv'); const m = mergeGeometries([g, t])!; m.computeVertexNormals(); return m; };
