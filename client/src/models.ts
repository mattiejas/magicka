import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ITEMS, MONSTERS, NODES, WOOD_COLORS } from '@magicka/shared';
export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
type V3 = [number, number, number];
export function part(g: THREE.BufferGeometry, color: string, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): THREE.BufferGeometry {
  const o = g.index ? g.toNonIndexed() : g.clone(); o.deleteAttribute('uv');
  o.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale)));
  const c = new THREE.Color(color), n = o.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) { const k = 1 + (((i * 7) % 11) / 11 - 0.5) * 0.12; for (let j = 0; j < 3; j++) { a[(i + j) * 3] = c.r * k; a[(i + j) * 3 + 1] = c.g * k; a[(i + j) * 3 + 2] = c.b * k; } }
  o.setAttribute('color', new THREE.BufferAttribute(a, 3)); return o;
}
export const merge = (l: THREE.BufferGeometry[]) => mergeGeometries(l)!;
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (a: number, b: number, h: number, s = 6) => new THREE.CylinderGeometry(a, b, h, s);
export const cone = (r: number, h: number, s = 6) => new THREE.ConeGeometry(r, h, s);
export const ico = (r: number) => new THREE.IcosahedronGeometry(r, 0);
export const shade = (c: string, k: number) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const LEAF = ['', '#8fae62', '#4d7a58', '#6f9048', '#c07a48', '#4a5668'];
export function nodeGeo(type: string): { full: THREE.BufferGeometry; spent: THREE.BufferGeometry; h: number } {
  const d = NODES[type], c = d.color;
  if (d.kind === 'tree') {
    const w = WOOD_COLORS[d.tier], l = LEAF[d.tier], stump = part(cyl(0.2, 0.28, 0.35), w, [0, 0.17, 0]);
    const trunk = part(cyl(0.13, 0.24, 1.5), w, [0, 0.75, 0]);
    const full = d.tier === 2 ? [trunk, part(cone(0.85, 1.2), l, [0, 1.5, 0]), part(cone(0.65, 1.1), l, [0, 2.2, 0]), part(cone(0.4, 0.9), l, [0, 2.85, 0])]
      : [trunk, part(ico(0.8), l, [0, 2, 0], [0.4, 0.3, 0], [1, 0.85, 1]), part(ico(0.52), l, [0.5, 1.7, 0.25]), part(ico(0.48), l, [-0.45, 1.8, -0.25]), ...(d.tier >= 3 ? [part(ico(0.5), shade(l, 1.1), [0, 2.6, 0.1])] : [])];
    return { full: merge(full), spent: stump, h: 2.8 };
  }
  if (d.kind === 'rock') {
    const base = '#7d7a74', rock = [part(ico(0.55), base, [0, 0.3, 0], [0.5, 0.2, 0], [1, 0.8, 1]), part(ico(0.34), shade(base, 0.9), [0.32, 0.18, 0.2])];
    const veins = type === 'essence_rock' ? [0, 1, 2, 3].map(i => part(cone(0.13, 0.7, 4), c, [Math.cos(i * 1.6) * 0.25, 0.75, Math.sin(i * 1.6) * 0.25], [Math.sin(i) * 0.4, 0, Math.cos(i) * 0.4]))
      : [0, 1, 2, 3, 4].map(i => part(ico(0.17), c, [Math.cos(i * 1.3) * 0.38, 0.35 + (i % 3) * 0.16, Math.sin(i * 1.3) * 0.38]));
    return { full: merge([...rock, ...veins]), spent: merge(rock), h: 0.95 };
  }
  const stem = '#6f8a52';
  const leaves = [0, 1, 2, 3, 4].map(i => part(cone(0.1, 0.5, 4), stem, [Math.cos(i * 1.26) * 0.2, 0.22, Math.sin(i * 1.26) * 0.2], [Math.sin(i * 1.26) * 0.5, 0, -Math.cos(i * 1.26) * 0.5]));
  if (type === 'berry_bush') { const bush = [part(ico(0.42), '#5f8050', [0, 0.35, 0]), part(ico(0.28), '#6b8c58', [0.25, 0.25, 0.15])]; return { full: merge([...bush, ...[0, 1, 2, 3, 4, 5].map(i => part(ico(0.08), c, [Math.cos(i) * 0.36, 0.3 + (i % 3) * 0.14, Math.sin(i) * 0.36]))]), spent: merge(bush), h: 0.8 }; }
  return { full: merge([...leaves, ...[0, 1, 2, 3].map(i => part(ico(0.13), c, [Math.cos(i * 1.6) * 0.22, 0.55 + (i % 2) * 0.12, Math.sin(i * 1.6) * 0.22]))]), spent: merge(leaves), h: 0.8 };
}
export function stationGeo(type: string): THREE.BufferGeometry {
  const s = '#8d8a83', w = '#8a6b48';
  switch (type) {
    case 'bank': return merge([part(box(0.95, 0.55, 0.7), w, [0, 0.3, 0]), part(box(0.95, 0.22, 0.7), shade(w, 1.15), [0, 0.7, 0]), part(box(1, 0.08, 0.74), '#b99a5a', [0, 0.57, 0]), part(box(0.16, 0.2, 0.06), '#d4b878', [0, 0.55, 0.38])]);
    case 'furnace': return merge([part(box(1, 1, 1), s, [0, 0.5, 0]), part(box(0.8, 0.6, 0.8), shade(s, 0.9), [0, 1.25, 0]), part(box(0.35, 0.7, 0.35), shade(s, 0.8), [0, 1.8, 0]), part(box(0.5, 0.4, 0.1), '#e08a4a', [0, 0.4, 0.48])]);
    case 'anvil': return merge([part(cyl(0.3, 0.36, 0.45), w, [0, 0.22, 0]), part(box(0.4, 0.16, 0.34), '#565b60', [0, 0.52, 0]), part(box(0.85, 0.18, 0.36), '#656b71', [0, 0.69, 0]), part(cone(0.16, 0.35, 4), '#656b71', [0.55, 0.7, 0], [0, 0, -1.57])]);
    case 'workbench': return merge([part(box(1, 0.12, 0.8), w, [0, 0.7, 0]), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => part(box(0.12, 0.7, 0.12), shade(w, 0.8), [x * 0.4, 0.35, z * 0.3])), part(box(0.3, 0.1, 0.12), '#777d82', [0.2, 0.8, 0]), part(box(0.35, 0.06, 0.3), '#c9b98e', [-0.2, 0.78, 0.1])]);
    case 'reaper': return merge([part(cone(0.45, 1.5, 7), '#3c4048', [0, 0.75, 0]), part(ico(0.26), '#33373e', [0, 1.5, 0]), part(ico(0.15), '#cfc8b8', [0, 1.46, 0.13]), part(cyl(0.03, 0.03, 1.9), w, [0.5, 0.95, 0.1]), part(box(0.5, 0.08, 0.04), '#a9aeb3', [0.3, 1.85, 0.1], [0, 0, 0.3])]);
    default: return merge([part(cyl(0.1, 0.1, 1.5), w, [0, 0.75, 0]), part(box(0.8, 0.45, 0.06), shade(w, 1.2), [0, 1.3, 0.1])]);
  }
}
export function boatGeo(done: (p: string) => number): THREE.BufferGeometry {
  const w = '#b08a5a', l: THREE.BufferGeometry[] = [part(box(0.1, 0.1, 3), shade(w, 0.7), [0, -0.1, 0])];
  if (done('hull') > 0) l.push(part(box(1.1, 0.12, 2.6 * done('hull')), w, [0, -0.05, 0]));
  if (done('hull') >= 1) l.push(part(box(0.1, 0.4, 2.6), w, [0.58, 0.15, 0], [0, 0, -0.2]), part(box(0.1, 0.4, 2.6), w, [-0.58, 0.15, 0], [0, 0, 0.2]), part(cone(0.6, 0.8, 4), w, [0, 0.1, -1.6], [-1.57, 0.78, 0], [1, 1, 0.5]));
  if (done('fittings') >= 1) l.push(part(box(1.25, 0.07, 0.1), '#c27c4e', [0, 0.34, 0.8]), part(box(1.25, 0.07, 0.1), '#c27c4e', [0, 0.34, -0.8]));
  if (done('sail') > 0) l.push(part(cyl(0.05, 0.06, 2.4), shade(w, 0.8), [0, 1.2, 0]), part(box(1.2, 1.3 * done('sail'), 0.04), '#e0d7bd', [0, 1.9 - 0.65 * done('sail') + 0.2, 0.06]));
  if (done('rudder') >= 1) l.push(part(box(0.08, 0.6, 0.4), shade(w, 0.75), [0, 0.1, 1.5]));
  return merge(l);
}
function weaponGeo(id: string): THREE.BufferGeometry {
  const i = ITEMS[id], c = i.color, w = '#7a5f42';
  switch (i.icon) {
    case 'sword': return merge([part(box(0.09, 0.8, 0.04), c, [0, 0.5, 0]), part(box(0.3, 0.06, 0.08), w, [0, 0.1, 0]), part(box(0.07, 0.2, 0.07), w, [0, 0, 0])]);
    case 'bow': return merge([part(new THREE.TorusGeometry(0.48, 0.035, 4, 8, Math.PI), c, [0, 0, 0], [0, 1.57, -1.57]), part(box(0.015, 0.96, 0.015), '#ddd6c4')]);
    case 'staff': return merge([part(cyl(0.04, 0.05, 1.4), c, [0, 0.3, 0]), part(new THREE.OctahedronGeometry(0.14), i.unique ? '#b7e07a' : '#8fb8d8', [0, 1.08, 0])]);
    case 'pickaxe': return merge([part(cyl(0.03, 0.04, 0.8), w, [0, 0.3, 0]), part(box(0.6, 0.09, 0.07), c, [0, 0.68, 0])]);
    default: return merge([part(cyl(0.03, 0.04, 0.8), w, [0, 0.3, 0]), part(box(0.28, 0.26, 0.05), c, [0.12, 0.62, 0])]);
  }
}
export interface Model { root: THREE.Group; parts: Record<string, THREE.Object3D>; h: number; kind: string; gear?: string }
const mesh = (g: THREE.BufferGeometry) => { const m = new THREE.Mesh(g, MAT); m.castShadow = true; return m; };
const pivot = (g: THREE.BufferGeometry, x: number, y: number, z = 0) => { const p = new THREE.Group(); p.position.set(x, y, z); p.add(mesh(g)); return p; };
export function playerModel(name: string, gear: (string | null)[]): Model {
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const skin = ['#e0b894', '#c99770', '#9a6b4a', '#6d4a35'][h % 4], hair = ['#4a3a2c', '#8a6a3f', '#2e2a2a', '#a8583a'][(h >> 2) % 4], cloth = ['#7d8f7a', '#8a7a94', '#7a8796', '#a08a6a'][(h >> 4) % 4];
  const col = (i: number, d: string) => (gear[i] ? ITEMS[gear[i]!].color : d);
  const root = new THREE.Group(), bc = col(2, cloth), lc = col(3, '#5f564c');
  const parts: Model['parts'] = {
    body: pivot(merge([part(box(0.46, 0.55, 0.28), bc, [0, 0.27, 0]), part(box(0.48, 0.08, 0.3), shade(bc, 0.7), [0, 0.02, 0])]), 0, 0.55),
    head: pivot(merge([part(box(0.3, 0.3, 0.28), skin, [0, 0.17, 0]), gear[1] ? part(box(0.36, 0.22, 0.34), col(1, hair), [0, 0.29, 0]) : part(box(0.33, 0.12, 0.31), hair, [0, 0.32, 0]), part(box(0.05, 0.05, 0.02), '#2d2a28', [0.07, 0.18, 0.15]), part(box(0.05, 0.05, 0.02), '#2d2a28', [-0.07, 0.18, 0.15])]), 0, 1.12),
    la: pivot(part(box(0.14, 0.5, 0.16), shade(bc, 0.9), [0, -0.22, 0]), 0.31, 1.06), ra: pivot(part(box(0.14, 0.5, 0.16), shade(bc, 0.9), [0, -0.22, 0]), -0.31, 1.06),
    ll: pivot(part(box(0.19, 0.55, 0.2), lc, [0, -0.27, 0]), 0.12, 0.55), rl: pivot(part(box(0.19, 0.55, 0.2), lc, [0, -0.27, 0]), -0.12, 0.55),
  };
  if (gear[0]) { const g = mesh(weaponGeo(gear[0])); g.position.set(0, -0.44, 0.06); g.rotation.x = ITEMS[gear[0]].icon === 'bow' ? 0 : 1.1; parts.ra.add(g); parts.weapon = g; }
  for (const p of Object.values(parts)) if (p !== parts.weapon) root.add(p);
  for (const [k, id] of [['tool_mine', 'worn_pickaxe'], ['tool_chop', 'worn_axe']]) { const g = mesh(weaponGeo(id)); g.position.set(0, -0.44, 0.06); g.rotation.x = 1.1; g.visible = false; parts.ra.add(g); parts[k] = g; }
  return { root, parts, h: 1.7, kind: 'p', gear: gear.join() };
}
export function monsterModel(type: string): Model {
  const d = MONSTERS[type], c = d.color, root = new THREE.Group(), parts: Model['parts'] = {}; let h = 1.1;
  const eye = (x: number, y: number, z: number, r = 0.06) => [part(box(r, r, 0.04), '#26231f', [x, y, z]), part(box(r, r, 0.04), '#26231f', [-x, y, z])];
  if (d.shape === 'beast') {
    const k = 0.8 + Math.min(0.6, d.level / 70), horn = type === 'stag' || type === 'drake' ? [part(cone(0.05, 0.5, 4), '#cfc6b0', [0.14, 0.4, 0], [0, 0, -0.5]), part(cone(0.05, 0.5, 4), '#cfc6b0', [-0.14, 0.4, 0], [0, 0, 0.5])] : type === 'boar' ? [part(cone(0.04, 0.2, 4), '#e5dcc8', [0.13, -0.06, 0.35], [0.6, 0, 0]), part(cone(0.04, 0.2, 4), '#e5dcc8', [-0.13, -0.06, 0.35], [0.6, 0, 0])] : [];
    const spikes = type === 'thornback' ? [0, 1, 2, 3].map(i => part(cone(0.08, 0.35, 4), shade(c, 0.6), [0, 0.35, -0.3 + i * 0.2])) : [];
    const wings = type === 'drake' ? [part(box(0.7, 0.04, 0.4), shade(c, 1.2), [0.5, 0.3, 0], [0, 0, 0.5]), part(box(0.7, 0.04, 0.4), shade(c, 1.2), [-0.5, 0.3, 0], [0, 0, -0.5])] : [];
    parts.body = pivot(merge([part(box(0.48, 0.45, 0.9), c), ...spikes, ...wings]), 0, 0.55); parts.head = pivot(merge([part(box(0.36, 0.34, 0.36), shade(c, 1.1), [0, 0, 0.15]), part(box(0.2, 0.16, 0.16), shade(c, 0.8), [0, -0.06, 0.38]), ...eye(0.12, 0.06, 0.34), ...horn]), 0, 0.72, 0.45);
    for (const [n, x, z] of [['ll', 0.17, 0.3], ['rl', -0.17, 0.3], ['rb', 0.17, -0.3], ['lb', -0.17, -0.3]] as const) parts[n] = pivot(part(box(0.13, 0.36, 0.13), shade(c, 0.75), [0, -0.17, 0]), x, 0.36, z);
    root.scale.setScalar(k); h = 1.15 * k;
  } else if (d.shape === 'wisp') {
    parts.body = pivot(merge([part(new THREE.OctahedronGeometry(0.32), c), part(new THREE.OctahedronGeometry(0.18), '#f0ece0', [0, 0, 0.2]), part(cone(0.2, 0.6, 5), shade(c, 0.8), [0, -0.4, 0], [Math.PI, 0, 0])]), 0, 1.05); h = 1.5;
  } else if (d.shape === 'plant') {
    parts.body = pivot(merge([part(cyl(0.12, 0.2, 0.7), shade(c, 0.7), [0, 0.35, 0]), part(ico(0.34), c, [0, 0.85, 0]), part(cone(0.16, 0.3, 5), '#c9605a', [0, 0.85, 0.34], [1.57, 0, 0]), ...[0, 1, 2, 3, 4].map(i => part(cone(0.09, 0.5, 4), shade(c, 0.85), [Math.cos(i * 1.26) * 0.3, 0.15, Math.sin(i * 1.26) * 0.3], [Math.sin(i * 1.26), 0, -Math.cos(i * 1.26)]))]), 0, 0); h = 1.3;
  } else if (d.shape === 'golem') {
    parts.body = pivot(merge([part(ico(0.5), c, [0, 0.3, 0], [0.3, 0.5, 0]), part(ico(0.26), shade(c, 1.1), [0, 0.85, 0.1]), ...eye(0.1, 0.88, 0.32)]), 0, 0.6); parts.la = pivot(part(box(0.24, 0.75, 0.26), shade(c, 0.85), [0, -0.3, 0]), 0.55, 1.05); parts.ra = pivot(part(box(0.24, 0.75, 0.26), shade(c, 0.85), [0, -0.3, 0]), -0.55, 1.05); parts.ll = pivot(part(box(0.26, 0.5, 0.28), shade(c, 0.75), [0, -0.2, 0]), 0.22, 0.45); parts.rl = pivot(part(box(0.26, 0.5, 0.28), shade(c, 0.75), [0, -0.2, 0]), -0.22, 0.45); h = 1.7;
  } else if (d.shape === 'crab') {
    parts.body = pivot(merge([part(ico(0.95), c, [0, 0, 0], [0, 0, 0], [1, 0.5, 0.8]), part(ico(0.25), '#8d9a94', [0.4, 0.4, -0.2]), part(ico(0.18), '#8d9a94', [-0.3, 0.45, -0.3]), part(cyl(0.05, 0.05, 0.4), c, [0.25, 0.45, 0.6]), part(cyl(0.05, 0.05, 0.4), c, [-0.25, 0.45, 0.6]), ...eye(0.25, 0.65, 0.62, 0.14), ...[0, 1, 2].flatMap(i => [part(box(0.7, 0.12, 0.12), shade(c, 0.8), [1, -0.2, 0.35 - i * 0.35], [0, 0, -0.5]), part(box(0.7, 0.12, 0.12), shade(c, 0.8), [-1, -0.2, 0.35 - i * 0.35], [0, 0, 0.5])])]), 0, 0.6);
    const claw = () => merge([part(box(0.18, 0.18, 0.6), shade(c, 0.9), [0, 0, 0.3]), part(ico(0.34), shade(c, 1.1), [0, 0, 0.75]), part(cone(0.12, 0.4, 4), shade(c, 1.2), [0.1, 0.08, 1.1], [1.57, 0, 0])]);
    parts.la = pivot(claw(), 0.75, 0.6, 0.5); parts.ra = pivot(claw(), -0.75, 0.6, 0.5); h = 1.7;
  } else {
    const l = '#7f9a58';
    parts.body = pivot(merge([part(cyl(0.75, 1.15, 2.6, 7), c, [0, 1.3, 0]), part(box(0.28, 0.2, 0.1), '#e0b95a', [0.35, 2, 0.78]), part(box(0.28, 0.2, 0.1), '#e0b95a', [-0.35, 2, 0.78]), part(box(0.7, 0.14, 0.1), '#2c2a20', [0, 1.5, 0.9]), part(ico(1.1), l, [0, 3.4, 0], [0.2, 0.4, 0], [1.2, 0.8, 1.2]), part(ico(0.7), shade(l, 1.1), [0.9, 3, 0.2]), part(ico(0.7), shade(l, 0.9), [-0.9, 3.1, -0.2]), ...[0, 1, 2, 3, 4, 5].map(i => part(cone(0.28, 1.3, 5), shade(c, 0.8), [Math.cos(i * 1.05) * 1.1, 0.2, Math.sin(i * 1.05) * 1.1], [Math.sin(i * 1.05) * 1.2, 0, -Math.cos(i * 1.05) * 1.2]))]), 0, 0);
    const arm = merge([part(cyl(0.24, 0.32, 1.8, 6), shade(c, 0.9), [0, -0.8, 0]), part(ico(0.48), shade(c, 0.75), [0, -1.8, 0])]);
    parts.la = pivot(arm, 1.1, 2.3); parts.ra = pivot(arm.clone(), -1.1, 2.3); h = 4.2;
  }
  for (const p of Object.values(parts)) root.add(p);
  return { root, parts, h, kind: d.shape };
}
export function dropModel(item: string): Model { const c = ITEMS[item].color, root = new THREE.Group(); root.add(mesh(merge([part(box(0.3, 0.22, 0.3), c, [0, 0.13, 0], [0, 0.5, 0]), part(box(0.16, 0.1, 0.16), shade(c, 1.2), [0.14, 0.06, 0.14])]))); if (ITEMS[item].unique) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45 })); b.position.y = 2; root.add(b); } return { root, parts: {}, h: 0.4, kind: 'd' }; }
export function graveModel(): Model { const root = new THREE.Group(); root.add(mesh(merge([part(box(0.5, 0.75, 0.16), '#9a978f', [0, 0.37, 0]), part(cyl(0.25, 0.25, 0.16, 8), '#9a978f', [0, 0.75, 0], [1.57, 0, 0]), part(box(0.7, 0.1, 0.9), '#6d5f48', [0, 0.05, 0.4])]))); return { root, parts: {}, h: 1, kind: 'g' }; }
