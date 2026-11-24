// Geometry helpers: every part is non-indexed with baked vertex colours so parts can be merged into one mesh.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
export const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
export type V3 = [number, number, number];
type G = THREE.BufferGeometry;
export function part(g: G, color: string, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): G {
  const o = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k);
  if (!o.attributes.normal) o.computeVertexNormals();
  o.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale)));
  const p = o.attributes.position, c = new THREE.Color(color), a = new Float32Array(p.count * 3);
  o.computeBoundingBox(); const y0 = o.boundingBox!.min.y, hh = Math.max(0.001, o.boundingBox!.max.y - y0);
  for (let i = 0; i < p.count; i++) { const k = 1.0 + ((p.getY(i) - y0) / hh) * 0.16 + noise(p.getX(i) * 6, p.getY(i) * 6, p.getZ(i) * 6) * 0.05; a[i * 3] = c.r * k; a[i * 3 + 1] = c.g * k; a[i * 3 + 2] = c.b * k; }
  o.setAttribute('color', new THREE.BufferAttribute(a, 3)); return o;
}
export const merge = (l: G[]) => mergeGeometries(l)!;
export const shade = (c: string, k: number) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
/** Smooth pseudo-noise in -1..1. */
export const noise = (x: number, y: number, z: number) => (Math.sin(x * 1.7 + y * 2.3 + 1.1) + Math.sin(y * 1.9 - z * 2.7 + 2.3) + Math.sin(z * 1.3 + x * 2.9 + 4.2)) / 3;
export const rbox = (w: number, h: number, d: number, r = 0.05, s = 3): G => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
export const ball = (r: number, d = 14): G => new THREE.SphereGeometry(r, d, Math.ceil(d * 0.75));
export const cyl = (a: number, b: number, h: number, s = 14): G => new THREE.CylinderGeometry(a, b, h, s, 2);
export const cone = (r: number, h: number, s = 12): G => new THREE.ConeGeometry(r, h, s, 3);
export const capsule = (r: number, len: number): G => new THREE.CapsuleGeometry(r, len, 5, 12);
/** Surface of revolution from [radius, y] pairs, smoothed. */
export function lathe(pts: [number, number][], seg = 18): G { const c = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(...p))); return new THREE.LatheGeometry(c.getPoints(pts.length * 4).map(p => new THREE.Vector2(Math.max(0.001, p.x), p.y)), seg); }
/** Organic lump. `rough` distorts it; `facet` keeps crisp stone-like faces. */
export function blob(r: number, detail = 3, rough = 0.15, seed = 0, facet = false): G {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const k = 1 + rough * (noise(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed) + 0.5 * noise(v.x * 5 - seed, v.y * 5 + seed, v.z * 5)); v.multiplyScalar(r * k); p.setXYZ(i, v.x, v.y, v.z); }
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  if (facet) { g.computeVertexNormals(); return g; }
  const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); return m;
}
/** Tapered tube along a curve: radius goes from r0 to r1. */
export function taper(pts: V3[], r0: number, r1: number, seg = 14, rad = 10): G {
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), g = new THREE.TubeGeometry(c, seg, 1, rad), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) { const o = c.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg); for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(p, k).sub(o).multiplyScalar(r).add(o); p.setXYZ(k, v.x, v.y, v.z); } }
  g.deleteAttribute('uv'); return g;
}
/** Bevelled plate cut from a 2D outline, centred in depth. */
export function plate(draw: (s: THREE.Shape) => void, depth: number, bevel = 0.015): G {
  const s = new THREE.Shape(); draw(s); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 12 }); g.translate(0, 0, -depth / 2); return g;
}
export const torus = (r: number, t: number, arc = Math.PI * 2): G => new THREE.TorusGeometry(r, t, 8, 24, arc);
export const gem = (r: number): G => new THREE.OctahedronGeometry(r, 0);
export const crystal = (r: number, h: number): G => { const g = new THREE.CylinderGeometry(r * 0.75, r, h * 0.7, 6).toNonIndexed(); const t = new THREE.ConeGeometry(r * 0.75, h * 0.3, 6).toNonIndexed(); t.translate(0, h * 0.5, 0); g.deleteAttribute('uv'); t.deleteAttribute('uv'); const m = mergeGeometries([g, t])!; m.computeVertexNormals(); return m; };
