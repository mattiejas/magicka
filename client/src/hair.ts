// Haircuts: a skin fade that follows the skull, with layered locks on top. Head space: chin near y 0.04, crown 0.335, face towards +z.
import * as THREE from 'three';
import { HAIRCUTS } from '@magicka/shared';
import { blob, part, shade, type Ring, type V3 } from './geo';
type G = THREE.BufferGeometry;
// Eight-sided so the face is a few broad planes. The step between rings 4 and 5 is the brow ledge over the eye sockets.
export const HEAD: Ring[] = [[0.035, 0.044, 0.026, 0.07], [0.05, 0.05, 0.042, 0.06], [0.105, 0.09, 0.08, 0.024], [0.165, 0.102, 0.1, 0.006], [0.208, 0.102, 0.095, 0.002], [0.226, 0.104, 0.11, 0.0], [0.29, 0.098, 0.108, -0.012], [0.335, 0.055, 0.07, -0.02]];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)), mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** Point on the skull at angle `a` and height `y`, pushed out by `off`. */
function skull(a: number, y: number, off: number): V3 {
  let i = 0; while (i < HEAD.length - 2 && HEAD[i + 1][0] < y) i++;
  const p = HEAD[i], q = HEAD[i + 1], t = clamp((y - p[0]) / (q[0] - p[0]), 0, 1), rx = mix(p[1], q[1], t) + off, rz = mix(p[2], q[2], t) + off, oz = mix(p[3] ?? 0, q[3] ?? 0, t);
  const s = Math.PI / 4, k = Math.floor((a - s / 2) / s), a0 = k * s + s / 2, f = (a - a0) / s;
  return [mix(Math.cos(a0), Math.cos(a0 + s), f) * rx, y, mix(Math.sin(a0), Math.sin(a0 + s), f) * rz + oz];
}
/** Lowest hair at an angle away from the face (0 = middle of the forehead, PI = nape). */
const LINE: [number, number][] = [[0, 0.292], [0.5, 0.29], [0.72, 0.275], [0.86, 0.245], [0.98, 0.232], [1.1, 0.17], [1.3, 0.165], [1.42, 0.228], [1.75, 0.23], [1.95, 0.18], [2.2, 0.13], [2.6, 0.1], [Math.PI, 0.095]];
function hairline(d: number) { for (let i = 1; i < LINE.length; i++) if (d <= LINE[i][0]) return mix(LINE[i - 1][1], LINE[i][1], (d - LINE[i - 1][0]) / (LINE[i][0] - LINE[i - 1][0])); return LINE.at(-1)![1]; }
/** Cropped sides and back, darkening from skin to hair as they rise. */
export function fade(skin: string, hair: string, depth: number): G[] {
  const N = 48, ROWS = 9, TOP = 0.333, out: G[] = [], sk = new THREE.Color(skin);
  const pt = (k: number, r: number): V3 => { const a = (k / N) * Math.PI * 2 + Math.PI / 2, d = Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))), lo = hairline(d), t = r / ROWS; return skull(a, mix(lo, TOP, t), 0.006 + t * 0.008); };
  for (let r = 0; r < ROWS; r++) {
    const pos: number[] = []; for (let k = 0; k < N; k++) { const a = pt(k, r), b = pt(k + 1, r), c = pt(k, r + 1), d = pt(k + 1, r + 1); pos.push(...a, ...c, ...b, ...b, ...c, ...d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.push(part(g, '#' + sk.clone().lerp(new THREE.Color(hair), clamp((r + 1.2) / (ROWS * depth * 0.62), 0.12, 0.94)).getHexString()));
  }
  const cap: number[] = []; for (let k = 0; k < N; k++) cap.push(...pt(k, ROWS), 0, 0.352, -0.02, ...pt(k + 1, ROWS));
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cap, 3)); out.push(part(cg, shade(hair, 0.92)));
  return out;
}
/** One chunky lock: ridged on top, widest a third of the way along, cut to a point. */
function lock(pts: V3[], w: number, th: number, lean: number, blunt = 0): G {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), SEG = 5, C = new THREE.Vector3(0, 0.22, -0.012), rings: THREE.Vector3[][] = [];
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG, p = curve.getPoint(t), tan = curve.getTangent(t), n = p.clone().sub(C); n.addScaledVector(tan, -n.dot(tan)).normalize();
    const s = new THREE.Vector3().crossVectors(tan, n), k = i === 0 ? 0.72 : t <= 0.4 ? 1 : Math.max(blunt * t, 1 - ((t - 0.4) / 0.6) ** 1.5) + 0.004;
    rings.push([p.clone().addScaledVector(s, w * k), p.clone().addScaledVector(n, th * k).addScaledVector(s, w * lean * k), p.clone().addScaledVector(s, -w * k), p.clone().addScaledVector(n, -th * 0.55 * k)]);
  }
  const pos: number[] = [], tri = (...v: THREE.Vector3[]) => v.forEach(p => pos.push(p.x, p.y, p.z));
  for (let i = 0; i < SEG; i++) for (let k = 0; k < 4; k++) { const a = rings[i][k], b = rings[i][(k + 1) % 4], c = rings[i + 1][k], d = rings[i + 1][(k + 1) % 4]; tri(a, c, b); tri(b, c, d); }
  const e = rings[SEG]; tri(e[0], e[2], e[1]); tri(e[0], e[3], e[2]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return g;
}
/** Top of the chosen cut. `seed` varies every lock a little; `flip` mirrors the part. */
export function haircut(style: number, hair: string, seed: number): G[] {
  const out: G[] = [], f = (seed >> 3) % 2 ? 1 : -1; let n = 0;
  const r = () => { const v = Math.sin(++n * 78.233 + seed * 0.37) * 43758.5453; return v - Math.floor(v); }, j = (k: number) => (r() - 0.5) * 2 * k;
  const add = (pts: V3[], w: number, th: number, tone = 1, blunt = 0) => out.push(part(lock(pts.map(([x, y, z]): V3 => [x * f, y, z]), w * (1 + j(0.22)), th * (1 + j(0.2)), j(0.35), blunt), shade(hair, tone * (1 + j(0.1)))));
  const cut = HAIRCUTS[style % HAIRCUTS.length].id;
  if (cut === 'quiff') {
    // Lifted off the forehead, highest off-centre, rolling back over a flatter crown.
    for (const [u, lift] of [[-0.95, 0.35], [-0.55, 0.62], [-0.15, 0.85], [0.28, 1], [0.66, 0.8], [1, 0.4]]) add([[u * 0.078, 0.282 + j(0.004), 0.084 - Math.abs(u) * 0.026], [u * 0.08 + 0.008, 0.318 + lift * 0.038, 0.112 - Math.abs(u) * 0.026], [u * 0.074 + 0.026, 0.342 + lift * 0.074, 0.09 - Math.abs(u) * 0.02], [u * 0.064 + 0.056 + j(0.012), 0.35 + lift * 0.07 + j(0.008), 0.026 + j(0.014)]], 0.027, 0.02, 1.1);
    for (const u of [-0.8, -0.3, 0.2, 0.7]) add([[u * 0.075, 0.325, 0.058], [u * 0.08 + 0.012, 0.372, 0.034], [u * 0.074 + 0.032 + j(0.012), 0.374 + j(0.01), -0.018], [u * 0.07 + 0.048, 0.35 + j(0.01), -0.066]], 0.032, 0.022, 1);
    for (const u of [-0.75, -0.2, 0.35, 0.85]) add([[u * 0.072, 0.332, -0.01], [u * 0.08 + 0.01, 0.356, -0.05], [u * 0.074 + 0.012, 0.328 + j(0.006), -0.1], [u * 0.062 + 0.012, 0.272 + j(0.014), -0.116]], 0.032, 0.018, 0.92);
    for (const s of [-1, 1]) add([[s * 0.08, 0.288, 0.058], [s * 0.094, 0.306, 0.02], [s * 0.096, 0.302, -0.034], [s * 0.084, 0.284, -0.078]], 0.024, 0.012, 0.88);
  } else if (cut === 'crop') {
    // Everything pushed forward into an uneven, blunt fringe.
    for (const u of [-0.8, -0.25, 0.3, 0.85]) add([[u * 0.06, 0.335, -0.05], [u * 0.078, 0.352, -0.07 + j(0.01)], [u * 0.076 + j(0.008), 0.315, -0.104], [u * 0.066 + j(0.01), 0.266 + j(0.014), -0.116]], 0.034, 0.02, 0.9);
    for (const u of [-0.9, -0.45, 0, 0.5, 0.95]) add([[u * 0.07, 0.335, -0.055], [u * 0.08 + j(0.01), 0.352, -0.02], [u * 0.078 + j(0.016), 0.362 + j(0.01), 0.028], [u * 0.076 + j(0.02), 0.366 + j(0.014), 0.07]], 0.034, 0.028, 1.02);
    for (const u of [-0.7, -0.2, 0.3, 0.75]) add([[u * 0.07, 0.345, 0.0], [u * 0.076 + j(0.012), 0.36, 0.034], [u * 0.078 + j(0.014), 0.35, 0.078], [u * 0.078 + 0.014 + j(0.014), 0.332 + j(0.012), 0.114]], 0.034, 0.028, 1.12);
    for (const [u, drop] of [[-1, 0.02], [-0.66, 0.0], [-0.36, 0.024], [-0.04, 0.006], [0.26, 0.032], [0.58, 0.01], [0.94, 0.028]]) add([[u * 0.07, 0.34, 0.045], [u * 0.082, 0.335, 0.09 - Math.abs(u) * 0.016], [u * 0.088 + 0.004, 0.302, 0.112 - Math.abs(u) * 0.03], [u * 0.086 + 0.012 + j(0.008), 0.276 - drop * 0.8 + j(0.003), 0.11 - Math.abs(u) * 0.034]], 0.031, 0.016, 1.02, 0.62);
  } else if (cut === 'sidepart') {
    // Hard part on one side, long top swept across and back, short on the other.
    for (const z of [0.07, 0.034, -0.002, -0.04, -0.076]) { const lift = clamp((z + 0.09) / 0.16, 0, 1); add([[0.052, 0.318 - Math.max(0, -z - 0.04) * 0.4, z], [0.012, 0.352 + lift * 0.03, z + 0.016 + lift * 0.014], [-0.05, 0.352 + lift * 0.026 + j(0.008), z + lift * 0.02], [-0.095 + j(0.005), 0.292 + lift * 0.012 + j(0.012), z - 0.026]], 0.032, 0.024, 1.02 + lift * 0.1); }
    for (const [z, y] of [[0.088, 0.3], [0.076, 0.318]]) add([[0.05, y - 0.004, z], [0.0, y + 0.034, z + 0.03], [-0.056, y + 0.028, z + 0.012], [-0.094, y - 0.02 + j(0.01), z - 0.034]], 0.028, 0.019, 1.16);
    for (const z of [0.052, 0.008, -0.04]) add([[0.056, 0.318, z], [0.08, 0.312, z - 0.006], [0.094, 0.286, z - 0.018], [0.096, 0.256 + j(0.008), z - 0.03]], 0.028, 0.011, 0.9);
    for (const u of [-0.8, -0.2, 0.4]) add([[u * 0.07, 0.33, -0.05], [u * 0.08, 0.338, -0.09], [u * 0.074 - 0.006, 0.302, -0.112], [u * 0.062 - 0.008, 0.25 + j(0.012), -0.118]], 0.034, 0.016, 0.9);
  } else {
    // Curls kept to the top, loose and uneven over the forehead.
    const C = 40; for (let i = 0; i < C; i++) { const el = Math.acos(1 - (i / C) * 0.62), az = i * 2.39996 + j(0.25), s = Math.sin(el), over = Math.sin(az) * s > 0.5; out.push(part(blob(0.027 + r() * 0.015, 2, 0.16, i), shade(hair, 0.92 + r() * 0.28), [Math.cos(az) * s * 0.103 * f, 0.262 + Math.cos(el) * 0.104 + j(0.008) - (over ? r() * 0.016 : 0), Math.sin(az) * s * 0.114 - 0.01 + (over ? 0.01 : 0)], [j(3), j(3), j(3)])); }
  }
  return out;
}
