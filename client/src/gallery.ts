// Dev-only page at /gallery.html. Query: ?set=people|monsters|nodes|camp&t=milliseconds (freeze the animation).
import * as THREE from 'three';
import { MONSTERS, NODES } from '@magicka/shared';
import { boatGeo, mesh, monsterModel, nodeGeo, playerModel, poseMonster, posePlayer, stationGeo } from './models';
const q = new URLSearchParams(location.search), set = q.get('set') ?? 'people', t = Number(q.get('t') ?? 0);
const r = new THREE.WebGLRenderer({ canvas: document.getElementById('c') as HTMLCanvasElement, antialias: true, preserveDrawingBuffer: true }), s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
r.shadowMap.enabled = true; r.toneMapping = THREE.NeutralToneMapping; s.background = new THREE.Color('#a9d8dc');
const sun = new THREE.DirectionalLight('#ffe3b0', 2.5); sun.position.set(5, 9, 7); sun.castShadow = true; const sc = sun.shadow.camera; sc.left = sc.bottom = -12; sc.right = sc.top = 12; sun.shadow.mapSize.set(2048, 2048);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6fb069' })); floor.receiveShadow = true; s.add(sun, new THREE.HemisphereLight('#dfe8ff', '#8c74a8', 1.7), floor);
const cols = set === 'people' ? 6 : set === 'monsters' ? 5 : 6, gap = set === 'people' ? 1.9 : set === 'monsters' ? 3 : 2.2; let n = 0;
const put = (o: THREE.Object3D, ry = 0.5) => { o.position.x = ((n % cols) - (cols - 1) / 2) * gap; o.position.z = -Math.floor(n / cols) * gap * 1.2; o.rotation.y = ry; s.add(o); n++; };
if (set === 'people') for (const [act, g, hit, ry] of [['', [null, null, null, null], 0, 0.4], ['mine', [null, null, null, null], 0, 1.3], ['chop', [null, null, null, null], 0, 1.3], ['craft', [null, null, null, null], 0, 1.3], ['pick', [null, null, null, null], 0, 1.1], ['walk', ['iron_sword', null, null, null], 0, 1], ['melee', ['cobalt_sword', 'cobalt_helm', 'cobalt_plate', 'cobalt_greaves'], 0.7, 0.8], ['ranged', ['oak_bow', 'leather_cowl_3', 'leather_jerkin_3', 'leather_chaps_3'], 0, 0.6], ['magic', ['maple_staff', 'cloth_hood_4', 'cloth_robe_4', 'cloth_skirt_4'], 0.4, 0.6], ['', ['rootcleaver', null, 'adamantite_plate', null], 0, 0.5], ['', ['briarstring', 'leather_cowl_5', 'leather_jerkin_5', null], 0, 0.5], ['eat', [null, null, null, null], 0, 0.5]] as [string, (string | null)[], number, number][]) { const m = playerModel('Name' + n, g); posePlayer(m, { act: act === 'walk' ? undefined : act, moving: act === 'walk', walk: 1, hit, t, tool: act === 'chop' ? 'iron_axe' : 'copper_pickaxe' }); put(m.root, ry); }
else if (set === 'monsters') for (const k of Object.keys(MONSTERS)) { const m = monsterModel(k); if (!MONSTERS[k].boss) poseMonster(m, { moving: false, walk: 0, hit: 0, t: t + 300, x: 0 }); put(m.root); }
else if (set === 'nodes') for (const k of Object.keys(NODES)) put(mesh(nodeGeo(k).full));
else { for (const k of ['bank', 'furnace', 'anvil', 'workbench', 'reaper', 'dock']) put(mesh(stationGeo(k)), 0.3); for (const k of [0.3, 1]) { put(mesh(boatGeo(() => k)), 0.9); n++; } }
const rows = Math.ceil(n / cols), w = cols * gap;
function draw() { r.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); const d = Math.max(w / cam.aspect, rows * gap * 1.1) / 2 / Math.tan(0.262) + 2; cam.position.set(0, d * 0.42 + 0.6, d * 0.9 - ((rows - 1) * gap * 1.2) / 2); cam.lookAt(0, 0.7, -((rows - 1) * gap * 1.2) / 2); r.render(s, cam); }
draw(); addEventListener('resize', draw); Object.assign(window, { tris: r.info.render.triangles });
