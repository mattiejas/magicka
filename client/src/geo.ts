// Geometry helpers for a chunky, faceted look: few large faces, flat normals, one baked colour per face.
// Callers pass the detail they would like; the helpers cap it so the whole game shares one style.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
export const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
export type V3 = [number, number, number];
type G = THREE.BufferGeometry;
export function part(g: G, color: string, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): G {
  const o = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(o.attributes)) if (k !== 'position' && k !== 'normal') o.deleteAttribute(k);
  o.deleteAttribute('normal'); // rebuilt below; non-indexed, so every face is flat
  o.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale)));
  o.computeVertexNormals();
  // Blend only very shallow edges; anything steeper stays a crisp facet.
  const soft = toCreasedNormals(o, CREASE); o.setAttribute('normal', soft.attributes.normal);
  o.computeBoundingBox(); const y0 = o.boundingBox!.min.y, hh = Math.max(0.001, o.boundingBox!.max.y - y0);
  const p = o.attributes.position, c = new THREE.Color(color), a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3, z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3, k = 1 + noise(x * 23, y * 19, z * 23) * 0.065, up = o.attributes.normal.getY(i);
    // Painted light: faces looking up drift warm, faces looking down drift plum.
    const f = c.clone().multiplyScalar(k); if (up > 0) f.lerp(WARM, up * 0.08); else f.lerp(COOL, -up * 0.2);
    f.lerp(COOL, 0.1 * (1 - (y - y0) / hh) ** 2);
    for (let j = 0; j < 3; j++) f.toArray(a, (i + j) * 3);
  }
  o.setAttribute('color', new THREE.BufferAttribute(a, 3)); return o;
}
const WARM = new THREE.Color('#ffe2a0'), COOL = new THREE.Color('#6a4258');
/** Bends a whole shape sideways as it rises. */
export function bend(g: THREE.BufferGeometry, amt: number, freq = 1.1) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * freq) * amt * Math.min(1, y)); p.setZ(i, p.getZ(i) + Math.sin(y * freq * 0.7 + 1) * amt * 0.5 * Math.min(1, y)); } g.computeVertexNormals(); return g; }
const CREASE = 0.17;
export const merge = (l: G[]) => mergeGeometries(l)!;
export const shade = (c: string, k: number) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
/** Smooth pseudo-noise in -1..1. */
export const noise = (x: number, y: number, z: number) => (Math.sin(x * 1.7 + y * 2.3 + 1.1) + Math.sin(y * 1.9 - z * 2.7 + 2.3) + Math.sin(z * 1.3 + x * 2.9 + 4.2)) / 3;
export const rbox = (w: number, h: number, d: number, r = 0.05, _s?: number): G => (Math.min(w, h, d) < 0.08 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, Math.min(r, Math.min(w, h, d) * 0.25)));
export const ball = (r: number, d = 14): G => new THREE.SphereGeometry(r, r < 0.06 ? 7 : d >= 18 ? 12 : 9, r < 0.06 ? 5 : d >= 18 ? 8 : 6);
export const cyl = (a: number, b: number, h: number, s = 10): G => new THREE.CylinderGeometry(a, b, h, Math.min(s, 10));
export const cone = (r: number, h: number, s = 6): G => new THREE.ConeGeometry(r, h, Math.min(s, 7));
export const capsule = (r: number, len: number): G => new THREE.CapsuleGeometry(r, len, 3, 9);
/** Surface of revolution from [radius, y] pairs. */
export const lathe = (pts: [number, number][], seg = 8): G => {
  // Profiles may be listed in either direction; wind them so faces always point outwards.
  const loop: [number, number][] = [...pts, [0, pts.at(-1)![1]], [0, pts[0][1]]], area = loop.reduce((t, [r, y], i) => { const [r2, y2] = loop[(i + 1) % loop.length]; return t + r * y2 - r2 * y; }, 0);
  if (area < 0) pts = [...pts].reverse();
  return new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(Math.max(0.001, p[0]), p[1])), seg >= 30 ? 16 : Math.min(seg, 12));
};
/** Sculpted tube: stacked elliptical rings of [y, radiusX, radiusZ, offsetZ, offsetX], capped at both ends.
 *  `shape` scales a vertex by its angle (0 = +x, PI/2 = front) and ring. */
export type Ring = [number, number, number, number?, number?];
export function loft(rings: Ring[], n = 10, shape: (a: number, i: number) => number = () => 1): G {
  const up = rings[0][0] < rings.at(-1)![0], rs = up ? rings : [...rings].reverse(), pos: number[] = [], idx = (i: number) => (up ? i : rings.length - 1 - i);
  const at = (i: number, k: number): V3 => { const [y, rx, rz, oz = 0, ox = 0] = rs[i], a = ((k % n) / n) * Math.PI * 2 + Math.PI / n, f = shape(a, idx(i)); return [Math.cos(a) * rx * f + ox, y, Math.sin(a) * rz * f + oz]; };
  const tri = (...v: V3[]) => v.forEach(p => pos.push(...p));
  for (let i = 0; i < rs.length - 1; i++) for (let k = 0; k < n; k++) { const a = at(i, k), b = at(i, k + 1), c = at(i + 1, k), d = at(i + 1, k + 1); if ((i + k) % 2) tri(a, c, b, b, c, d); else tri(a, c, d, a, d, b); }
  for (const [i, flip] of [[0, false], [rs.length - 1, true]] as const) { const [y, , , oz = 0, ox = 0] = rs[i]; for (let k = 0; k < n; k++) { const a = at(i, k), b = at(i, k + 1), m: V3 = [ox, y, oz]; if (flip) tri(m, b, a); else tri(m, a, b); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
/** A loft whose profile is curved between the given rings. Keeps the original rings' shaping. */
export function sculpt(rings: Ring[], n = 14, shape: (a: number, i: number) => number = () => 1): G {
  const full = rings.map(([y, x, z, oz = 0, ox = 0]) => [y, x, z, oz, ox]), out: Ring[] = [];
  full.forEach((r, i) => { out.push(r as Ring); if (i === full.length - 1) return; const a = full[Math.max(0, i - 1)], b = full[i + 1], c = full[Math.min(full.length - 1, i + 2)]; out.push(r.map((v, k) => (k ? (9 * (v + b[k]) - a[k] - c[k]) / 16 : (v + b[0]) / 2)) as Ring); });
  return loft(out, n, (a, i) => (shape(a, Math.floor(i / 2)) + shape(a, Math.ceil(i / 2))) / 2);
}
/** Organic lump. `rough` distorts it; `facet` keeps crisp stone-like faces. */
export function blob(r: number, _detail = 3, rough = 0.15, seed = 0, _facet = false): G {
  const g = new THREE.IcosahedronGeometry(r, r < 0.1 ? 0 : r < 0.3 ? 1 : r < 0.9 ? 2 : 3), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const k = 1 + rough * (noise(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2 - seed) + 0.5 * noise(v.x * 5 - seed, v.y * 5 + seed, v.z * 5)); v.multiplyScalar(r * k); p.setXYZ(i, v.x, v.y, v.z); }
  return g;
}
/** Tapered tube along a curve: radius goes from r0 to r1. */
export function taper(pts: V3[], r0: number, r1: number, seg = 14, rad = 10): G {
  seg = Math.min(seg, Math.max(2, (pts.length - 1) * 3)); rad = r0 > 0.22 ? 10 : Math.min(rad, 7);
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), g = new THREE.TubeGeometry(c, seg, 1, rad), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) { const o = c.getPointAt(i / seg), r = r0 + (r1 - r0) * (i / seg); for (let j = 0; j <= rad; j++) { const k = i * (rad + 1) + j; v.fromBufferAttribute(p, k).sub(o).multiplyScalar(r).add(o); p.setXYZ(k, v.x, v.y, v.z); } }
  g.deleteAttribute('uv'); return g;
}
/** Bevelled plate cut from a 2D outline, centred in depth. */
export function plate(draw: (s: THREE.Shape) => void, depth: number, bevel = 0.015): G {
  const s = new THREE.Shape(); draw(s); const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 6 }); g.translate(0, 0, -depth / 2); return g;
}
export const torus = (r: number, t: number, arc = Math.PI * 2): G => new THREE.TorusGeometry(r, t, 6, r > 0.3 ? 18 : 12, arc);
export const gem = (r: number): G => new THREE.OctahedronGeometry(r, 0);
export const crystal = (r: number, h: number): G => { const g = new THREE.CylinderGeometry(r * 0.75, r, h * 0.7, 6).toNonIndexed(); const t = new THREE.ConeGeometry(r * 0.75, h * 0.3, 6).toNonIndexed(); t.translate(0, h * 0.5, 0); g.deleteAttribute('uv'); t.deleteAttribute('uv'); const m = mergeGeometries([g, t])!; m.computeVertexNormals(); return m; };
