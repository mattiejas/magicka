import * as THREE from 'three';
import { BOAT_PARTS, ITEMS, MAPS, MONSTERS, NODES, T, mulberry, type Ent, type GameEvent, type GameMap, type MapId } from '@magicka/shared';
import { MAT, blob, merge, noise, part, rbox, shade, taper } from './geo';
import { STRIKE_AT, boatGeo, dropModel, graveModel, monsterModel, nodeGeo, playerModel, poseMonster, posePlayer, stationGeo, type Model } from './models';
import { moving, posOf, state, tickNow, type Track } from './net';
const COLORS = ['#4f7f8a', '#d8c79a', '#88a566', '#b39a72', '#99958c', '#a3825a'];
export interface Pick { kind: 'node' | 'station' | 'ent'; id: string; name: string; type: string; box: THREE.Box3; e?: Ent }
export class Scene {
  r: THREE.WebGLRenderer; s = new THREE.Scene(); cam = new THREE.PerspectiveCamera(45, 1, 0.1, 140);
  yaw = 0; pitch = 0.95; dist = 15; private focus = new THREE.Vector3(32, 0, 35);
  private world = new THREE.Group(); private map: MapId | null = null; private models = new Map<string, { m: Model; yaw: number }>();
  private nodeInst = new Map<string, { full: THREE.InstancedMesh; spent: THREE.InstancedMesh; i: number; m: THREE.Matrix4; on: boolean }>();
  private picks: Pick[] = []; private sun = new THREE.DirectionalLight('#fff0d8', 2.5);
  private hover = square('#f0ead8', 0.55); private dest = square('#8fd0c0', 0.8); private mine = square('#8fd0c0', 0.28);
  private tele = new Map<string, { g: THREE.Group; key: string; fx: ((k: number, st: string) => void)[] }>();
  private boat: THREE.Mesh | null = null; private boatKey = ''; private fx: { o: THREE.Object3D; t0: number; ms: number; f: (o: THREE.Object3D, k: number) => void }[] = [];
  texts: { x: number; y: number; h: number; text: string; cls: string; at: number; el?: HTMLElement }[] = [];
  private lastAct = new Map<string, number>(); private water: THREE.Mesh | null = null;
  constructor(canvas: HTMLCanvasElement, private overlay: HTMLElement) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true }); this.r.toneMapping = THREE.NeutralToneMapping; this.r.toneMappingExposure = 1.1; this.r.shadowMap.enabled = true; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.s.background = new THREE.Color('#b9cdd0'); this.s.fog = new THREE.Fog('#b9cdd0', 34, 70);
    this.s.add(new THREE.HemisphereLight('#e9f0f2', '#a39a82', 2.3), this.sun, this.sun.target, this.world, this.hover, this.dest, this.mine);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); const c = this.sun.shadow.camera; c.left = c.bottom = -24; c.right = c.top = 24; c.far = 80; this.sun.shadow.bias = -0.001; this.sun.shadow.normalBias = 0.03;
    this.dest.visible = this.hover.visible = false; this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() { const w = innerWidth, h = innerHeight; this.r.setPixelRatio(Math.min(2, devicePixelRatio)); this.r.setSize(w, h); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
  private load(id: MapId) {
    this.map = id; const m = MAPS[id];
    this.world.traverse(o => { const q = o as THREE.Mesh; if (q.geometry) q.geometry.dispose(); }); this.world.clear(); this.nodeInst.clear(); this.picks = []; this.boat = null; this.boatKey = '';
    for (const k of [...this.models.keys()]) this.remove(k);
    for (const t of this.tele.values()) this.s.remove(t.g); this.tele.clear();
    this.world.add(terrain(m));
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(m.size + 160, m.size + 160).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5fa0a8', transparent: true, opacity: 0.74, roughness: 0.35 })); this.water.position.set(m.size / 2, -0.22, m.size / 2); this.world.add(this.water);
    const by: Record<string, typeof m.nodes> = {}; for (const n of m.nodes) (by[n.type] ??= []).push(n);
    const rnd = mulberry(3);
    for (const [type, list] of Object.entries(by)) {
      const g = nodeGeo(type), full = new THREE.InstancedMesh(g.full, MAT, list.length), spent = new THREE.InstancedMesh(g.spent, MAT, list.length); full.castShadow = spent.castShadow = full.receiveShadow = spent.receiveShadow = true; full.frustumCulled = spent.frustumCulled = false;
      list.forEach((n, i) => { const k = 0.9 + rnd() * 0.25, mt = new THREE.Matrix4().compose(new THREE.Vector3(n.x + 0.5, 0, n.y + 0.5), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), new THREE.Vector3(k, k, k)); full.setMatrixAt(i, mt); spent.setMatrixAt(i, ZERO); this.nodeInst.set(n.id, { full, spent, i, m: mt, on: true }); this.picks.push({ kind: 'node', id: n.id, name: NODES[type].name, type, box: bx(n.x, n.y, 1, g.h) }); });
      this.world.add(full, spent);
    }
    for (const s of m.stations) { const o = new THREE.Mesh(stationGeo(s.type), MAT); o.position.set(s.x + 0.5, 0, s.y + 0.5); o.castShadow = o.receiveShadow = true; this.world.add(o); this.picks.push({ kind: 'station', id: s.id, name: STATION[s.type], type: s.type, box: bx(s.x, s.y, 1, 1.5) }); }
    this.detail(m, rnd);
  }
  private detail(m: GameMap, rnd: () => number) {
    const blades = [0, 1, 2, 3, 4].map(i => { const a = i * 1.26; return part(taper([[Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03], [Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05], [Math.cos(a) * 0.13, 0.2 + (i % 2) * 0.06, Math.sin(a) * 0.13]], 0.016, 0.002, 4, 3), shade('#8fae66', 0.9 + (i % 3) * 0.08)); });
    const kinds: [THREE.BufferGeometry, number, number][] = [[merge(blades), m.size * 22, T.GRASS], [merge([...blades.slice(0, 2), part(taper([[0, 0, 0], [0.02, 0.26, 0]], 0.012, 0.01, 3, 4), '#7d9660'), ...[0, 1, 2, 3, 4].map(i => part(blob(0.03, 1, 0, 0), '#f0e6c8', [0.02 + Math.cos(i * 1.26) * 0.045, 0.27, Math.sin(i * 1.26) * 0.045])), part(blob(0.028, 1, 0, 0), '#dcb45e', [0.02, 0.28, 0])]), m.size * 3, T.GRASS], [merge([part(blob(0.07, 2, 0.25, 1, true), '#a39d92', [0, 0.02, 0]), part(blob(0.04, 1, 0.2, 2, true), '#938d84', [0.09, 0.01, 0.04])]), m.size * 3, -1]];
    for (const [g, n, tile] of kinds) {
      const list: THREE.Matrix4[] = [];
      for (let i = 0; i < n; i++) { const x = rnd() * m.size, y = rnd() * m.size, ti = (y | 0) * m.size + (x | 0), t = m.tiles[ti]; if (m.blocked[ti] || t === T.WATER || t === T.WOOD || (tile >= 0 ? t !== tile : t === T.GRASS)) continue; const k = 0.75 + rnd() * 0.6; list.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28), new THREE.Vector3(k, k, k))); }
      const im = new THREE.InstancedMesh(g, MAT, list.length); list.forEach((q, i) => im.setMatrixAt(i, q)); im.receiveShadow = true; im.frustumCulled = false; this.world.add(im);
    }
  }
  private remove(id: string) { const o = this.models.get(id); if (!o) return; this.s.remove(o.m.root); o.m.root.traverse(c => (c as THREE.Mesh).geometry?.dispose()); this.models.delete(id); this.lastAct.delete(id); }
  marker(x: number, y: number) { this.dest.position.set(x + 0.5, 0.03, y + 0.5); this.dest.visible = true; }
  event(ev: GameEvent) {
    if (ev.e === 'hit') {
      const to = state.ents.get(ev.to), from = state.ents.get(ev.from); this.lastAct.set(ev.from, performance.now());
      if (!to) return; const [x, y] = posOf(to), sz = to.e.type ? MONSTERS[to.e.type]?.size ?? 1 : 1, h = this.models.get(ev.to)?.m.h ?? 1.6;
      const land = () => this.texts.push({ x: x + sz / 2, y: y + sz / 2, h: h + 0.2, text: ev.dmg ? String(ev.dmg) : '0', cls: ev.dmg ? (ev.to === state.me ? 'dmg me' : 'dmg') : 'dmg miss', at: performance.now() });
      if (from && (ev.style === 'ranged' || ev.style === 'magic')) {
        const [fx, fy] = posOf(from), o = new THREE.Mesh(ev.style === 'magic' ? new THREE.OctahedronGeometry(0.16) : new THREE.BoxGeometry(0.05, 0.05, 0.5), new THREE.MeshBasicMaterial({ color: ev.style === 'magic' ? '#a9d0ea' : '#e5d9bd' }));
        this.add(o, 280, (o, k) => { o.position.set(fx + 0.5 + (x + sz / 2 - fx - 0.5) * k, 1 + Math.sin(k * 3.14) * 0.3, fy + 0.5 + (y + sz / 2 - fy - 0.5) * k); o.lookAt(x + sz / 2, 1, y + sz / 2); }); setTimeout(land, 280);
      } else land();
    } else if (ev.e === 'impact') for (const [x, y] of ev.tiles) if ((x + y) % 2 === 0) { const o = new THREE.Mesh(CHIP, new THREE.MeshStandardMaterial({ color: ev.atk === 'vines' ? '#6f9048' : '#9a8f7c' })); const a = Math.random() * 6; this.add(o, 500, (o, k) => { o.position.set(x + 0.5 + Math.cos(a) * k, Math.sin(k * 3.14) * 1.1, y + 0.5 + Math.sin(a) * k); o.scale.setScalar(1 - k); }); }
  }
  private add(o: THREE.Mesh, ms: number, f: (o: THREE.Object3D, k: number) => void) { f(o, 0); this.s.add(o); this.fx.push({ o, ms, t0: performance.now(), f }); }
  private ray(mx: number, my: number) { const r = new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2((mx / innerWidth) * 2 - 1, 1 - (my / innerHeight) * 2), this.cam); return r; }
  pick(mx: number, my: number): { hits: Pick[]; tile: [number, number] | null } {
    const r = this.ray(mx, my), v = new THREE.Vector3(), list: [number, Pick][] = [];
    const test = (p: Pick) => { if (r.ray.intersectBox(p.box, v)) list.push([v.distanceTo(r.ray.origin) - (p.kind === 'ent' && p.e!.k === 'm' ? 0.6 : 0), p]); };
    for (const p of this.picks) { const n = this.nodeInst.get(p.id); if (n && !n.on) continue; test(p); }
    for (const t of state.ents.values()) {
      const e = t.e; if (e.k === 'n' || e.id === state.me) continue; const [x, y] = posOf(t), sz = e.k === 'm' ? MONSTERS[e.type!].size : 1;
      test({ kind: 'ent', id: e.id, e, type: e.type ?? '', name: e.k === 'm' ? MONSTERS[e.type!].name : e.k === 'd' ? ITEMS[e.type!].name + (e.qty! > 1 ? ` (${e.qty})` : '') : e.k === 'g' ? 'Your grave' : e.name!, box: bx(x, y, sz, this.models.get(e.id)?.m.h ?? 1) });
    }
    const g = r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), v), N = this.map ? MAPS[this.map].size : 0;
    const tile: [number, number] | null = g && v.x >= 0 && v.z >= 0 && v.x < N && v.z < N ? [Math.floor(v.x), Math.floor(v.z)] : null;
    return { hits: list.sort((a, b) => a[0] - b[0]).map(l => l[1]), tile };
  }
  setHover(t: [number, number] | null) { this.hover.visible = !!t; if (t) this.hover.position.set(t[0] + 0.5, 0.025, t[1] + 0.5); }
  project(x: number, y: number, h: number): [number, number, boolean] { const v = new THREE.Vector3(x, h, y).project(this.cam); return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight, v.z < 1]; }
  frame(dt: number) {
    const self = state.self; if (!self || !state.me) { this.r.render(this.s, this.cam); return; }
    if (this.map !== self.map) this.load(self.map);
    const now = performance.now(), me = state.ents.get(state.me);
    const depleted = new Set<string>(); for (const t of state.ents.values()) if (t.e.k === 'n') depleted.add(t.e.id);
    for (const [id, n] of this.nodeInst) { const on = !depleted.has(id); if (on !== n.on) { n.on = on; n.full.setMatrixAt(n.i, on ? n.m : ZERO); n.spent.setMatrixAt(n.i, on ? ZERO : n.m); n.full.instanceMatrix.needsUpdate = n.spent.instanceMatrix.needsUpdate = true; } }
    for (const id of [...this.models.keys()]) if (!state.ents.has(id)) this.remove(id);
    for (const t of state.ents.values()) this.entity(t, now, dt);
    for (const id of [...this.tele.keys()]) if (!state.ents.get(id)?.e.boss) { this.s.remove(this.tele.get(id)!.g); this.tele.delete(id); }
    if (me) {
      const [x, y] = posOf(me); this.focus.lerp(new THREE.Vector3(x + 0.5, 0.6, y + 0.5), this.focus.distanceTo(new THREE.Vector3(x, 0, y)) > 12 ? 1 : 1 - Math.exp(-dt * 10));
      this.mine.position.set(me.e.x + 0.5, 0.02, me.e.y + 0.5);
      if (this.dest.visible && Math.hypot(me.e.x + 0.5 - this.dest.position.x, me.e.y + 0.5 - this.dest.position.z) < 0.1 && !moving(me)) this.dest.visible = false;
    }
    this.boatModel();
    if (this.water) this.water.position.y = -0.22 + Math.sin(now / 1600) * 0.03;
    const f = this.focus, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.cam.position.set(f.x + Math.sin(this.yaw) * cp * this.dist, f.y + sp * this.dist, f.z + Math.cos(this.yaw) * cp * this.dist); this.cam.lookAt(f);
    this.sun.position.set(f.x + 14, 26, f.z + 10); this.sun.target.position.copy(f);
    this.fx = this.fx.filter(e => { const k = (now - e.t0) / e.ms; if (k >= 1) { this.s.remove(e.o); return false; } e.f(e.o, k); return true; });
    this.r.render(this.s, this.cam); this.labels(now);
  }
  private boatModel() {
    const s = state.self!, m = MAPS[s.map], d = m.stations.find(s => s.type === 'dock')!, key = s.map + JSON.stringify(s.boat);
    if (key === this.boatKey) return; this.boatKey = key; if (this.boat) this.world.remove(this.boat);
    this.boat = new THREE.Mesh(boatGeo(p => Math.min(1, (s.boat[p] ?? 0) / BOAT_PARTS.find(b => b.id === p)!.qty)), MAT); this.boat.position.set(d.x + 2.2, -0.05, d.y + 2.4); this.boat.castShadow = true; this.world.add(this.boat);
  }
  private entity(t: Track, now: number, dt: number) {
    const e = t.e; if (e.k === 'n') return;
    let o = this.models.get(e.id); const gear = e.gear?.join();
    if (o && e.k === 'p' && o.m.gear !== gear) { this.remove(e.id); o = undefined; }
    if (!o) { const m = e.k === 'p' ? playerModel(e.name!, e.gear!) : e.k === 'm' ? monsterModel(e.type!) : e.k === 'd' ? dropModel(e.type!) : graveModel(); o = { m, yaw: 0 }; this.models.set(e.id, o); this.s.add(m.root); }
    const [x, y] = posOf(t), sz = e.k === 'm' ? MONSTERS[e.type!].size : 1, mv = moving(t), root = o.m.root, p = o.m.parts;
    root.position.set(x + sz / 2, e.k === 'd' ? 0.04 + Math.sin(now / 500) * 0.04 : 0, y + sz / 2);
    let face: number | null = null;
    if (mv) { const k = Math.min(0.999, (now - t.at) / 600) * t.path.length, i = Math.floor(k), a = i ? t.path[i - 1] : t.from, b = t.path[Math.min(i, t.path.length - 1)]; if (a[0] !== b[0] || a[1] !== b[1]) face = Math.atan2(b[0] - a[0], b[1] - a[1]); }
    else if (e.tgt || e.boss) { const tid = e.boss?.tgt ?? e.tgt ?? (e.boss ? state.me : ''), q = state.ents.get(tid), n = q && q.e.k !== 'n' ? posOf(q) : this.picks.find(k => k.id === tid)?.box.min; if (n) { const tx = Array.isArray(n) ? n[0] + (q!.e.k === 'm' ? MONSTERS[q!.e.type!].size / 2 : 0.5) : n.x + 0.5, tz = Array.isArray(n) ? n[1] + (q!.e.k === 'm' ? MONSTERS[q!.e.type!].size / 2 : 0.5) : n.z + 0.5; if (Math.hypot(tx - root.position.x, tz - root.position.z) > 0.1) face = Math.atan2(tx - root.position.x, tz - root.position.z); } }
    if (face !== null) { const d = Math.atan2(Math.sin(face - o.yaw), Math.cos(face - o.yaw)); o.yaw += d * (1 - Math.exp(-dt * 14)); }
    if (e.k === 'p' || e.k === 'm') root.rotation.y = o.yaw;
    const hit = Math.max(0, 1 - (now - (this.lastAct.get(e.id) ?? -1e9)) / 550), pose = { act: mv ? undefined : e.act, walk: now / 105, moving: mv, hit, t: now, tool: e.tool };
    if (e.k === 'p') { posePlayer(o.m, pose); this.chips(e, o.yaw, now); }
    else if (e.k === 'm') { if (e.boss) this.boss(e, p, x, y, sz); else poseMonster(o.m, { ...pose, x }); }
  }
  /** Debris thrown up at the moment a tool lands. */
  private struck = new Map<string, number>();
  private chips(e: Ent, yaw: number, now: number) {
    const ms = e.act === 'mine' || e.act === 'chop' ? 1200 : e.act === 'craft' ? 750 : 0; if (!ms) return;
    const n = Math.floor(now / ms - STRIKE_AT), was = this.struck.get(e.id); this.struck.set(e.id, n); if (was === undefined || was === n || !e.tgt && e.act !== 'craft') return;
    const color = e.act === 'mine' ? '#8f8a82' : e.act === 'chop' ? '#d0b183' : '#f0b060', cx = e.x + 0.5 + Math.sin(yaw) * 0.62, cz = e.y + 0.5 + Math.cos(yaw) * 0.62, y0 = e.act === 'craft' ? 0.85 : 0.6;
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, v = 0.25 + Math.random() * 0.4, up = 0.4 + Math.random() * 0.5, o = new THREE.Mesh(CHIP, new THREE.MeshStandardMaterial({ color, roughness: 1, emissive: e.act === 'craft' ? '#b06020' : '#000000' })); this.add(o, 450 + Math.random() * 200, (o, k) => { o.position.set(cx + Math.cos(a) * v * k, Math.max(0.03, y0 + up * k * 1.6 - 2 * k * k), cz + Math.sin(a) * v * k); o.rotation.set(k * 9, k * 7, 0); o.scale.setScalar((1 - k * 0.6) * (e.act === 'craft' ? 0.5 : 1)); }); }
  }
  private boss(e: Ent, p: Model['parts'], bx0: number, by0: number, sz: number) {
    const b = e.boss!, tk = tickNow(), k = b.st === 'windup' ? Math.min(1, (tk - b.start) / Math.max(1, b.end - b.start)) : b.st === 'execute' ? Math.min(1, (tk - b.start) / Math.max(1, b.end - b.start)) : 0;
    const crab = !!p.la && MONSTERS[e.type!].shape === 'crab';
    let la = 0, ra = 0, tilt = Math.sin(performance.now() / 900) * 0.02;
    if (b.st === 'windup') { const up = b.atk === 'melee' ? [0, 1] : b.atk === 'vines' ? [0.4, 0.4] : [1, 1]; la = -up[0] * k * (crab ? 0.9 : 2.6); ra = -up[1] * k * (crab ? 1.1 : 2.6); tilt -= k * 0.12; if (b.atk === 'vines' && !crab) { la = ra = 0.5 * k; } }
    else if (b.st === 'execute') { const s = Math.max(0, 1 - k * 2); la = b.atk === 'melee' ? 0 : -s; ra = -s; tilt += s * 0.22; }
    p.la.rotation.x = la; p.ra.rotation.x = ra; p.body.rotation.x = tilt;
    let t = this.tele.get(e.id);
    const wkey = b.st !== 'choose' && b.tiles?.length ? `${b.atk}:${JSON.stringify(b.tiles)}` : '';
    if (t && t.key !== wkey) { this.s.remove(t.g); this.tele.delete(e.id); t = undefined; }
    if (!t && wkey) { t = this.telegraph(b.atk!, b.tiles!, [bx0 + sz / 2, by0 + sz / 2], crab); t.key = wkey; this.tele.set(e.id, t); this.s.add(t.g); }
    if (t) for (const f of t.fx) f(k, b.st);
  }
  private telegraph(atk: string, tiles: [number, number][], from: [number, number], crab: boolean) {
    const g = new THREE.Group(), fx: ((k: number, st: string) => void)[] = [], set = new Set(tiles.map(t => t.join()));
    const col = atk === 'vines' ? '#4f6b34' : atk === 'quake' ? '#7a4a30' : '#2f2b2a';
    const fill = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false }), geo = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2), im = new THREE.InstancedMesh(geo, fill, tiles.length);
    tiles.forEach(([x, y], i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x + 0.5, 0.035, y + 0.5))); im.frustumCulled = false; g.add(im);
    fx.push((k, st) => { fill.opacity = st === 'windup' ? 0.12 + k * 0.33 : 0.5 * (1 - k); });
    if (atk === 'boulder') {
      let cs = tiles.filter(([x, y]) => [-1, 0, 1].every(i => [-1, 0, 1].every(j => set.has(`${x + i},${y + j}`)))); if (!cs.length) cs = [tiles[tiles.length >> 1]];
      for (const [x, y] of cs) {
        const sh = new THREE.Mesh(new THREE.CircleGeometry(1.45, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#201d1c', transparent: true, depthWrite: false })); sh.position.set(x + 0.5, 0.045, y + 0.5);
        const rock = new THREE.Mesh(merge([part(blob(0.95, 4, 0.18, 3, true), '#8a857e'), part(blob(0.3, 3, 0.2, 5, true), '#7a756e', [0.7, 0.3, 0.3])]), MAT); rock.castShadow = true; g.add(sh, rock);
        fx.push((k, st) => {
          sh.scale.setScalar(st === 'windup' ? 0.15 + k * 0.85 : 1); (sh.material as THREE.MeshBasicMaterial).opacity = st === 'windup' ? 0.15 + k * 0.5 : 0.5 * (1 - k);
          if (st === 'windup') { if (crab) { rock.position.set(from[0] + (x + 0.5 - from[0]) * k, 1 + Math.sin(k * 3.14) * 5, from[1] + (y + 0.5 - from[1]) * k); rock.visible = k > 0.15; } else { const f = Math.max(0, (k - 0.55) / 0.45); rock.visible = k > 0.55; rock.position.set(x + 0.5, 0.5 + (1 - f * f) * 14, y + 0.5); } rock.rotation.x = k * 5; }
          else { rock.visible = true; rock.position.set(x + 0.5, 0.35 - k * 1.3, y + 0.5); }
        });
      }
    } else if (atk === 'vines') for (const [x, y] of tiles) for (let i = 0; i < 4; i++) { const a = i * 1.57 + x, v = new THREE.Mesh(part(taper([[0, 0, 0], [0.06, 0.35, 0.03], [-0.04, 0.7, 0], [0.05, 1, 0.04]], 0.075, 0.01, 16, 8), '#5f7f3a'), MAT); v.position.set(x + 0.5 + Math.cos(a) * 0.26, 0, y + 0.5 + Math.sin(a) * 0.26); v.castShadow = true; g.add(v); fx.push((k, st) => { v.scale.y = st === 'windup' ? 0.08 + k * 0.45 : 1.5 * (1 - k * 0.8); const lean = st === 'windup' ? Math.sin(performance.now() / 200 + a) * 0.15 : 0.7; v.rotation.set(-Math.sin(a) * lean, 0, Math.cos(a) * lean); }); }
    else for (const [x, y] of tiles) { const v = new THREE.Mesh(part(blob(0.32, 3, 0.25, x + y, true), '#75644c', [0, 0, 0], [0.2, x + y, 0.3], [1, 1.1, 0.6]), MAT); v.position.set(x + 0.5, -0.4, y + 0.5); g.add(v); fx.push((k, st) => { v.position.y = st === 'windup' ? -0.34 + k * 0.14 + Math.sin(performance.now() / 40 + x) * 0.02 * k : 0.25 - k * 0.8; }); }
    return { g, key: '', fx };
  }
  private tags = new Map<string, { el: HTMLElement; name: HTMLElement; bar: HTMLElement }>();
  private labels(now: number) {
    for (const [id, t] of this.tags) if (!state.ents.has(id)) { t.el.remove(); this.tags.delete(id); }
    for (const t of state.ents.values()) {
      const e = t.e; if (e.k !== 'p' && e.k !== 'm') continue;
      const hurt = e.hp! < e.mhp!, show = e.k === 'p' || hurt || !!e.boss; let g = this.tags.get(e.id);
      if (!show) { if (g) { g.el.remove(); this.tags.delete(e.id); } continue; }
      if (!g) { const el = document.createElement('div'), name = document.createElement('span'), bar = document.createElement('i'), wrap = document.createElement('b'); el.className = 'tag'; wrap.append(bar); el.append(name, wrap); this.overlay.append(el); g = { el, name, bar }; this.tags.set(e.id, g); name.textContent = e.k === 'p' ? e.name! : MONSTERS[e.type!].name; }
      const [x, y] = posOf(t), sz = e.k === 'm' ? MONSTERS[e.type!].size : 1, [sx, sy, ok] = this.project(x + sz / 2, y + sz / 2, (this.models.get(e.id)?.m.h ?? 1.6) + 0.25);
      g.el.style.display = ok ? '' : 'none'; g.el.style.transform = `translate(${sx | 0}px,${sy | 0}px) translate(-50%,-100%)`; g.bar.parentElement!.style.visibility = hurt ? '' : 'hidden'; g.bar.style.width = `${(100 * e.hp!) / e.mhp!}%`;
    }
    this.texts = this.texts.filter(t => { const k = (now - t.at) / 1000; if (k >= 1) { t.el?.remove(); return false; } if (!t.el) { t.el = document.createElement('div'); t.el.className = t.cls; t.el.textContent = t.text; this.overlay.append(t.el); } const [sx, sy] = this.project(t.x, t.y, t.h + k * 0.7); t.el.style.transform = `translate(${sx | 0}px,${sy | 0}px) translate(-50%,-50%)`; t.el.style.opacity = String(1 - k * k); return true; });
  }
}
const STATION: Record<string, string> = { bank: 'Bank chest', furnace: 'Furnace', anvil: 'Anvil', workbench: 'Workbench', reaper: 'Reaper', dock: 'Shipwright' };
const CHIP = new THREE.IcosahedronGeometry(0.055, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const bx = (x: number, y: number, s: number, h: number) => new THREE.Box3(new THREE.Vector3(x + 0.08, 0, y + 0.08), new THREE.Vector3(x + s - 0.08, h, y + s - 0.08));
function square(c: string, o: number) { const s = new THREE.Shape(); s.moveTo(-0.48, -0.48); s.lineTo(0.48, -0.48); s.lineTo(0.48, 0.48); s.lineTo(-0.48, 0.48); const h = new THREE.Path(); h.moveTo(-0.41, -0.41); h.lineTo(-0.41, 0.41); h.lineTo(0.41, 0.41); h.lineTo(0.41, -0.41); s.holes.push(h); return new THREE.Mesh(new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })); }
const SUB = 4;
/** Subdivided ground: land stays flat for tile play, colours and the shoreline are blended and softened. */
function terrain(m: GameMap) {
  const N = m.size, V = N * SUB + 1, pos = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3), idx: number[] = [], cs = COLORS.map(c => new THREE.Color(c));
  const at = (x: number, y: number) => { const t = x < 0 || y < 0 || x >= N || y >= N ? T.WATER : m.tiles[y * N + x]; return t === T.WOOD ? T.WATER : t; };
  const wet = new THREE.Color('#b3a67f'), deep = new THREE.Color('#4a7680');
  for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
    const wx = i / SUB, wy = j / SUB, ox = noise(wx * 1.9, wy * 1.9, 3) * 0.3, oy = noise(wx * 1.9, wy * 1.9, 9) * 0.3;
    const px = wx - 0.5, py = wy - 0.5, x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    const land = (q: number, r: number) => (at(q, r) === T.WATER ? 0 : 1);
    const mask = (land(x0, y0) * (1 - fx) + land(x0 + 1, y0) * fx) * (1 - fy) + (land(x0, y0 + 1) * (1 - fx) + land(x0 + 1, y0 + 1) * fx) * fy;
    const h = mask >= 1 ? 0 : mask > 0.5 ? -0.16 * (1 - (mask - 0.5) * 2) ** 2 : -0.16 - (0.5 - mask) * 1.6;
    const k = (j * V + i) * 3; pos[k] = wx; pos[k + 1] = h; pos[k + 2] = wy;
    const cx = px + ox, cy = py + oy, a0 = Math.floor(cx), b0 = Math.floor(cy), sx = THREE.MathUtils.smoothstep(cx - a0, 0.25, 0.75), sy = THREE.MathUtils.smoothstep(cy - b0, 0.25, 0.75);
    let r = 0, g = 0, b = 0, sum = 0;
    for (const [q, p, w] of [[a0, b0, (1 - sx) * (1 - sy)], [a0 + 1, b0, sx * (1 - sy)], [a0, b0 + 1, (1 - sx) * sy], [a0 + 1, b0 + 1, sx * sy]]) { const t = at(q, p); if (t === T.WATER || !w) continue; r += cs[t].r * w; g += cs[t].g * w; b += cs[t].b * w; sum += w; }
    const c = sum ? new THREE.Color(r / sum, g / sum, b / sum) : wet.clone();
    if (mask < 1) c.lerp(wet, (1 - mask) * 0.6); if (mask < 0.5) c.lerp(deep, (0.5 - mask) * 1.4);
    c.multiplyScalar(0.98 + noise(wx * 0.9, wy * 0.9, 1) * 0.045 + noise(wx * 5, wy * 5, 2) * 0.02);
    col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
  }
  for (let j = 0; j < V - 1; j++) for (let i = 0; i < V - 1; i++) { const a = j * V + i; idx.push(a, a + V, a + 1, a + 1, a + V, a + V + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const grp = new THREE.Group(), gm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); gm.receiveShadow = true; grp.add(gm);
  // Faint tile lines keep distances readable.
  const line: number[] = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (at(x, y) !== T.WATER) line.push(x, 0.012, y, x + 1, 0.012, y, x, 0.012, y, x, 0.012, y + 1);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(line, 3)); grp.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#3a4a30', transparent: true, opacity: 0.09, depthWrite: false })));
  const planks: THREE.BufferGeometry[] = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.tiles[y * N + x] === T.WOOD) { for (let i = 0; i < 3; i++) planks.push(part(rbox(0.99, 0.09, 0.3, 0.02, 2), shade('#a3825a', 0.93 + ((x * 3 + y * 5 + i * 2) % 5) * 0.035), [x + 0.5, -0.045, y + 0.17 + i * 0.33])); if (y % 3 === 0 && (m.tiles[y * N + x - 1] !== T.WOOD || m.tiles[y * N + x + 1] !== T.WOOD)) planks.push(part(new THREE.CylinderGeometry(0.09, 0.1, 1.1, 12), '#7d6144', [x + (m.tiles[y * N + x - 1] !== T.WOOD ? 0.02 : 0.98), -0.2, y + 0.5])); }
  if (planks.length) { const pm = new THREE.Mesh(merge(planks), MAT); pm.receiveShadow = pm.castShadow = true; grp.add(pm); }
  return grp;
}
