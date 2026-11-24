import { BOAT_PARTS, GAME_NAME, ITEMS, MAPS, MAX_LEVEL, MONSTERS, RECIPES, SKILLS, SLOTS, TICK_MS, levelForXp, maxHp, xpForLevel, type ServerMsg, type Skill, type Stack, type StationType } from '@magicka/shared';
import { connect, hasToken, logout, onClosed, onMsg, posOf, resume, send, state } from '../net';
import { icon } from './icons';
import './style.css';
type Child = Node | string | null | false;
export function h(tag: string, props: Record<string, unknown> = {}, ...kids: Child[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === 'html') e.innerHTML = v as string; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v as EventListener); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, String(v)); }
  for (const c of kids) if (c) e.append(c); return e;
}
const $ = (id: string) => document.getElementById(id)!;
const ui = () => $('ui');
let tab: 'inventory' | 'equipment' | 'skills' = 'inventory', open: StationType | null = null, qty = 1, tier = 1;
const lvl = (s: Skill) => levelForXp(state.self!.xp[s]);
const have = (id: string) => state.self!.inv.reduce((n, s) => n + (s?.id === id ? s.qty : 0), 0);
const fmt = (n: number) => (n >= 10000 ? `${Math.floor(n / 1000)}k` : String(n));
// --- tooltip and menu
let tip: HTMLElement | null = null;
export function tooltip(text: string, x: number, y: number) { if (!text) { tip?.remove(); tip = null; return; } if (!tip) { tip = h('div', { id: 'tip', class: 'panel' }); ui().append(tip); } tip.textContent = text; const r = tip.getBoundingClientRect(); tip.style.left = `${Math.min(x + 14, innerWidth - r.width - 8)}px`; tip.style.top = `${Math.min(y + 16, innerHeight - r.height - 8)}px`; }
export const closeMenu = () => document.getElementById('menu')?.remove();
export function menu(x: number, y: number, items: [string, () => void][]) { closeMenu(); tooltip('', 0, 0); if (!items.length) return; const m = h('div', { id: 'menu', class: 'panel' }, ...items.map(([t, f]) => h('button', { onclick: () => { closeMenu(); f(); } }, t))); ui().append(m); const r = m.getBoundingClientRect(); m.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`; m.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`; }
export function describe(id: string): string {
  const i = ITEMS[id], l = [i.name]; const st: string[] = [];
  if (i.style) st.push(i.style); if (i.acc) st.push(`accuracy ${i.acc}`); if (i.power) st.push(`power ${i.power}`); if (i.armour) st.push(`armour ${i.armour}`); if (i.heal) st.push(`heals ${i.heal}`);
  if (st.length) l.push(st.join(', ')); for (const [s, n] of Object.entries(i.req ?? {})) if (n > 1) l.push(`Requires ${s} ${n}`); if (i.unique) l.push('Unique'); return l.join('\n');
}
function slot(s: Stack | null | undefined, opt: { label?: string; click?: (ev: MouseEvent) => void; ctx?: () => [string, () => void][] } = {}) {
  return h('button', { class: 'slot', disabled: !s, 'aria-label': s ? ITEMS[s.id].name : opt.label ?? 'Empty', html: s ? icon(s.id) + (s.qty > 1 ? `<span>${fmt(s.qty)}</span>` : '') : opt.label ? `<small>${opt.label}</small>` : '', onclick: opt.click && ((ev: MouseEvent) => { tooltip('', 0, 0); opt.click!(ev); }), oncontextmenu: (ev: MouseEvent) => { ev.preventDefault(); if (s && opt.ctx) menu(ev.clientX, ev.clientY, opt.ctx()); }, onmousemove: (ev: MouseEvent) => s && tooltip(describe(s.id), ev.clientX, ev.clientY), onmouseleave: () => tooltip('', 0, 0) });
}
// --- login
export function showLogin(msg = '') {
  ui().replaceChildren(); $('overlay').replaceChildren();
  const name = h('input', { name: 'name', autocomplete: 'username', maxlength: 16, required: true, pattern: '[A-Za-z0-9_]{3,16}', title: '3 to 16 letters, digits or underscores' }) as HTMLInputElement, pw = h('input', { name: 'pw', type: 'password', autocomplete: 'current-password', minlength: 8, maxlength: 128, required: true }) as HTMLInputElement;
  const err = h('div', { class: 'err', role: 'alert' }, msg), form = h('form', {}) as HTMLFormElement;
  const go = (t: 'login' | 'register') => { if (!form.reportValidity()) return; err.textContent = ''; connect({ t, name: name.value, pw: pw.value }); };
  form.append(h('h1', {}, GAME_NAME), h('div', { class: 'mute' }, 'Gather, craft, build a boat, and bring friends for what waits on the mainland.'), h('label', {}, 'Name', name), h('label', {}, 'Password, at least 8 characters', pw), err, h('div', { class: 'row' }, h('button', { class: 'primary', type: 'submit' }, 'Log in'), h('button', { type: 'button', onclick: () => go('register') }, 'Create account')));
  form.addEventListener('submit', ev => { ev.preventDefault(); go('login'); });
  ui().append(h('div', { id: 'login', class: 'panel' }, form)); name.focus();
}
// --- game shell
function shell() {
  ui().replaceChildren(
    h('div', { id: 'vitals', class: 'panel' }),
    h('div', { id: 'top' }, h('div', { id: 'hint', class: 'panel', hidden: true }), h('div', { id: 'boss', class: 'panel', hidden: true })),
    h('div', { id: 'map', class: 'panel' }, h('canvas', { width: 416, height: 416, id: 'mm', onclick: mapClick }), h('div', { class: 'cap', id: 'mapcap' })),
    h('div', { id: 'side', class: 'panel' }, h('div', { class: 'tabs' }, ...(['inventory', 'equipment', 'skills'] as const).map(t => h('button', { 'data-t': t, onclick: () => { tab = t; side(); } }, t[0].toUpperCase() + t.slice(1)))), h('div', { class: 'body' })),
    h('div', { id: 'chat', class: 'panel' }, h('div', { class: 'log', 'aria-live': 'polite' }), h('input', { id: 'chat-in', placeholder: 'Enter to chat', 'aria-label': 'Chat', maxlength: 160, onkeydown: (ev: KeyboardEvent) => { const i = ev.target as HTMLInputElement; if (ev.key === 'Enter') { if (i.value.trim()) send({ t: 'chat', text: i.value.trim() }); i.value = ''; i.blur(); } if (ev.key === 'Escape') i.blur(); } })),
    h('div', { id: 'drops' }));
}
export function log(text: string, cls = 'info', from?: string) { const l = document.querySelector('#chat .log'); if (!l) return; l.append(h('div', { class: `k-${cls}` }, from ? h('b', {}, `${from}: `) : null, text)); while (l.children.length > 120) l.firstChild!.remove(); l.scrollTop = l.scrollHeight; }
function vitals() {
  const s = state.self, me = state.ents.get(state.me)?.e, v = document.getElementById('vitals'); if (!s || !v) return;
  const mx = maxHp(lvl('vitality')), hp = me?.hp ?? mx;
  const key = `${hp}/${mx}`; if (v.dataset.k === key) return; v.dataset.k = key;
  v.replaceChildren(h('div', { class: 'row' }, h('h2', {}, s.name), h('button', { onclick: () => { logout(); showLogin(); } }, 'Log out')), h('div', { class: 'row' }, h('span', { class: 'mute' }, 'Health'), h('span', { class: 'num' }, `${hp} / ${mx}`)), h('div', { class: `bar ${hp < mx * 0.3 ? 'low' : ''}` }, h('i', { style: `width:${(100 * hp) / mx}%` })));
}
function side() {
  const s = state.self, b = document.querySelector('#side .body'); if (!s || !b) return;
  document.querySelectorAll('#side .tabs button').forEach(t => t.classList.toggle('on', (t as HTMLElement).dataset.t === tab));
  if (tab === 'inventory') b.replaceChildren(h('div', { class: 'grid' }, ...s.inv.map((it, i) => {
    const act = () => { if (!it) return; const d = ITEMS[it.id]; if (open === 'bank') send({ t: 'bank', op: 'deposit', item: it.id, qty }); else if (d.heal) send({ t: 'eat', slot: i }); else if (d.slot) send({ t: 'equip', slot: i }); };
    const el = slot(it, { click: act, ctx: () => { const d = ITEMS[it!.id], l: [string, () => void][] = []; if (d.heal) l.push([`Eat ${d.name}`, () => send({ t: 'eat', slot: i })]); if (d.slot) l.push([`Equip ${d.name}`, () => send({ t: 'equip', slot: i })]); if (open === 'bank') l.push(['Deposit all', () => send({ t: 'bank', op: 'deposit', item: it!.id, qty: 1_000_000 })]); l.push([`Drop ${d.name}`, () => send({ t: 'drop', slot: i })]); return l; } });
    el.draggable = !!it; el.addEventListener('dragstart', ev => ev.dataTransfer!.setData('text', String(i))); el.addEventListener('dragover', ev => ev.preventDefault()); el.addEventListener('drop', ev => { ev.preventDefault(); const a = Number(ev.dataTransfer!.getData('text')); if (a !== i) send({ t: 'swap', a, b: i }); }); if (!it) el.removeAttribute('disabled'); return el;
  })));
  else if (tab === 'equipment') { let a = 0, p = 0, r = 0; for (const [k, e] of Object.entries(s.equip)) { if (k === 'ammo') continue; const i = ITEMS[e!.id]; a += i.acc ?? 0; p += i.power ?? 0; r += i.armour ?? 0; } b.replaceChildren(h('div', { class: 'grid', style: 'grid-template-columns:repeat(3,1fr)' }, ...SLOTS.map(k => slot(s.equip[k], { label: k, click: () => send({ t: 'unequip', slot: k }) }))), h('p', { class: 'mute num', style: 'margin:12px 0 0' }, `Accuracy ${a}   Power ${p}   Armour ${r}`)); }
  else b.replaceChildren(h('div', { class: 'skills' }, ...SKILLS.map(k => { const l = lvl(k), x = s.xp[k], lo = xpForLevel(l), hi = xpForLevel(l + 1); return h('div', { class: 'skill', title: l >= MAX_LEVEL ? `${x} xp` : `${x} xp, ${hi - x} to level ${l + 1}` }, h('span', {}, k), h('b', { class: 'num' }, String(l)), h('div', { class: 'bar' }, h('i', { style: `width:${l >= MAX_LEVEL ? 100 : (100 * (x - lo)) / (hi - lo)}%` }))); })));
}
// --- station panels
export function closePanel() { open = null; document.getElementById('station')?.remove(); tooltip('', 0, 0); }
const TITLES: Record<StationType, string> = { bank: 'Bank', furnace: 'Furnace', anvil: 'Anvil', workbench: 'Workbench', reaper: 'Reaper', dock: 'Shipwright' };
function panel() {
  const s = state.self; if (!open || !s) return;
  const old = document.getElementById('station'), top = old?.querySelector('.body')?.scrollTop ?? 0, body = h('div', { class: 'body' });
  const qtys = (l: [string, number][]) => h('div', { class: 'bar2' }, ...l.map(([t, n]) => h('button', { class: qty === n ? 'on' : '', onclick: () => { qty = n; panel(); } }, t)), open === 'bank' && h('button', { style: 'margin-left:auto', onclick: () => send({ t: 'depositAll' }) }, 'Deposit inventory'));
  if (open === 'bank') body.append(qtys([['1', 1], ['5', 5], ['All', 1_000_000]]), s.bank.length ? h('div', { class: 'grid' }, ...s.bank.map(b => slot(b, { click: () => send({ t: 'bank', op: 'withdraw', item: b.id, qty }), ctx: () => [['Withdraw all', () => send({ t: 'bank', op: 'withdraw', item: b.id, qty: 1_000_000 })]] }))) : h('p', { class: 'mute' }, 'Nothing stored. Click items in your inventory to deposit them.'));
  else if (open === 'reaper') body.append(h('p', {}, s.reaper.length ? 'I kept what you dropped. Take it, there is no charge.' : 'Nothing of yours has come to me.'), h('div', { class: 'grid', style: 'margin-bottom:12px' }, ...s.reaper.map(b => slot(b))), s.reaper.length ? h('button', { onclick: () => send({ t: 'claim' }) }, 'Take my items') : null as never);
  else if (open === 'dock') {
    for (const p of BOAT_PARTS) { const n = s.boat[p.id] ?? 0; body.append(h('div', { class: 'recipe' }, h('span', { html: icon(p.item) }), h('div', {}, p.name, h('small', { class: 'num' }, `${ITEMS[p.item].name}: ${n} of ${p.qty} placed, ${have(p.item)} carried`)), h('span', { class: n >= p.qty ? 'k-level' : 'mute' }, n >= p.qty ? 'Done' : ''))); }
    body.append(h('div', { style: 'margin-top:12px' }, s.boatDone ? h('button', { onclick: () => { send({ t: 'boat', op: 'sail' }); closePanel(); } }, s.map === 'island' ? `Sail to ${MAPS.mainland.name}` : `Sail to ${MAPS.island.name}`) : h('button', { onclick: () => send({ t: 'boat', op: 'build' }) }, 'Add what I am carrying')));
  } else {
    const rs = RECIPES.filter(r => r.station === open);
    body.append(h('div', { class: 'bar2' }, ...[1, 2, 3, 4, 5].map(t => h('button', { class: tier === t ? 'on' : '', onclick: () => { tier = t; panel(); } }, `Tier ${t}`))));
    for (const r of rs.filter(r => ITEMS[r.out].tier === tier)) {
      const ok = lvl(r.skill) >= r.level, mat = r.in.every(([i, n]) => have(i) >= n), need = h('small', {}); r.in.forEach(([i, n], k) => need.append(k ? ', ' : '', h('span', { class: have(i) >= n ? '' : 'no' }, `${n} ${ITEMS[i].name}`)));
      const go = (q: number) => send({ t: 'craft', id: r.id, qty: q });
      body.append(h('div', { class: `recipe ${ok ? '' : 'locked'}`, title: describe(r.out) }, h('span', { html: icon(r.out) }), h('div', {}, ITEMS[r.out].name + (r.qty > 1 ? ` x${r.qty}` : ''), ok ? need : h('small', {}, h('span', { class: 'no' }, `Requires ${r.skill} ${r.level}`))), h('div', { class: 'btns' }, ...([['1', 1], ['5', 5], ['All', 999]] as const).map(([t, q]) => h('button', { disabled: !ok || !mat, onclick: () => go(q) }, t)))));
    }
  }
  const el = h('div', { id: 'station', class: 'panel', role: 'dialog', 'aria-label': TITLES[open] }, h('header', {}, h('h2', {}, TITLES[open]), h('button', { onclick: () => { closePanel(); side(); } }, 'Close')), body);
  if (old) old.replaceWith(el); else ui().append(el); body.scrollTop = top;
}
// --- hints: first unmet step wins
function hint() {
  const s = state.self, el = document.getElementById('hint'); if (!s || !el) return;
  const inAny = (f: (id: string) => boolean) => [...s.inv, ...Object.values(s.equip), ...s.bank].some(i => i && f(i.id));
  const me = state.ents.get(state.me)?.e, nearBoss = me && [...state.ents.values()].some(t => t.e.k === 'm' && t.e.boss && Math.hypot(t.e.x - me.x, t.e.y - me.y) < 12);
  let t = '';
  if (s.reaper.length) t = 'Your items are safe. Return to your grave, or ask the reaper at camp.';
  else if (nearBoss && s.xp.vitality < xpForLevel(12)) t = 'Marked ground is about to be hit. Step off it before the attack lands.';
  else if (s.map === 'island' && !s.boatDone) {
    if (s.xp.mining === 0) t = 'Mine copper on the rise north-east of camp.';
    else if (s.xp.woodcutting === 0) t = 'Chop ash in the grove north-west of camp. You need logs for handles and bows.';
    else if (s.xp.smithing === 0) t = 'Smelt copper ore into bars at the furnace in camp.';
    else if (!inAny(i => ['copper_pickaxe', 'copper_axe', 'copper_sword'].includes(i)) ) t = 'Smith a copper tool or sword at the anvil. Better tools gather faster.';
    else if (!s.equip.weapon) t = 'Click a weapon in your inventory to equip it. Swords, bows and staves each train their own style.';
    else if (s.xp.vitality < 60) t = 'Fight the boars south-west of camp. Their hides become leather at the workbench.';
    else if ((s.boat.hull ?? 0) < 20) t = 'Bring 20 ash logs to the shipwright at the south dock to start a boat.';
    else if ((s.boat.rudder ?? 0) < 1 && !inAny(i => i === 'rudder')) t = 'Old Gnashclaw, on the eastern sand, swallowed the rudder. Bring food and watch the ground.';
    else t = 'Finish the boat at the dock: copper bars for fittings, flax for the sail, and the rudder.';
  } else if (s.map === 'island') t = 'Your boat is ready. Speak to the shipwright to sail to the mainland.';
  el.hidden = !t; if (el.textContent !== t) el.textContent = t;
}
// --- minimap
let base: { id: string; c: HTMLCanvasElement } | null = null; const R = 26;
function mapClick(ev: MouseEvent) { const me = state.ents.get(state.me); if (!me) return; const b = (ev.target as HTMLElement).getBoundingClientRect(), x = Math.round(me.e.x + ((ev.clientX - b.left) / b.width - 0.5) * R * 2), y = Math.round(me.e.y + ((ev.clientY - b.top) / b.height - 0.5) * R * 2); if (x >= 0 && y >= 0) send({ t: 'move', x, y }); }
function minimap() {
  const s = state.self, me = state.ents.get(state.me), cv = document.getElementById('mm') as HTMLCanvasElement | null; if (!s || !me || !cv) return;
  const m = MAPS[s.map], N = m.size;
  if (base?.id !== m.id) { const c = document.createElement('canvas'); c.width = c.height = N * 4; const g = c.getContext('2d')!; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { g.fillStyle = ['#4f7f8a', '#d8c79a', '#88a566', '#b39a72', '#99958c', '#a3825a'][m.tiles[y * N + x]]; g.fillRect(x * 4, y * 4, 4, 4); } for (const n of m.nodes) { g.fillStyle = n.type.startsWith('tree') ? '#54703f' : n.type.startsWith('plant') || n.type === 'berry_bush' ? '#b8bf6a' : '#5f5c57'; g.fillRect(n.x * 4, n.y * 4, 4, 4); } g.fillStyle = '#2a343b'; for (const t of m.stations) g.fillRect(t.x * 4 - 1, t.y * 4 - 1, 6, 6); base = { id: m.id, c }; }
  const g = cv.getContext('2d')!, [px, py] = posOf(me), k = cv.width / (R * 2); g.imageSmoothingEnabled = false; g.fillStyle = '#4f7f8a'; g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(base.c, (px + 0.5 - R) * 4, (py + 0.5 - R) * 4, R * 8, R * 8, 0, 0, cv.width, cv.height);
  const dot = (x: number, y: number, c: string, r: number) => { g.fillStyle = c; g.fillRect((x + 0.5 - px - 0.5 + R) * k - r, (y + 0.5 - py - 0.5 + R) * k - r, r * 2, r * 2); };
  for (const t of state.ents.values()) { const [x, y] = posOf(t); if (t.e.k === 'm') dot(x, y, t.e.boss ? '#c9604a' : '#d9a05b', t.e.boss ? 8 : 4); else if (t.e.k === 'p') dot(x, y, t.e.id === state.me ? '#f5f0e4' : '#7cc0b1', 5); else if (t.e.k === 'd') dot(x, y, '#e3c274', 3); else if (t.e.k === 'g') dot(x, y, '#222a30', 6); }
  g.font = '20px "Avenir Next","Segoe UI",sans-serif'; g.textAlign = 'center'; for (const l of m.labels) { const x = (l.x - px + R) * k, y = (l.y - py + R) * k; g.lineWidth = 4; g.strokeStyle = 'rgba(34,42,48,.8)'; g.strokeText(l.name, x, y); g.fillStyle = '#f5f0e4'; g.fillText(l.name, x, y); }
  if (s.map === 'mainland' && state.boss.alive) { const b = m.spawns.find(x => MONSTERS[x.type].boss?.world)!, dx = b.x - px, dy = b.y - py, d = Math.max(Math.abs(dx), Math.abs(dy)), f = d > R - 2 ? (R - 2) / d : 1; dot(px + dx * f, py + dy * f, '#c9604a', 8); }
}
function bossUi() {
  const cap = document.getElementById('mapcap'); if (!cap || !state.self) return;
  const left = Math.max(0, Math.round((state.boss.next * TICK_MS - (performance.now() - state.boss.at)) / 1000));
  const t = state.boss.alive ? 'Awake now' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const k = t + state.boss.online + state.self.map; if (cap.dataset.k !== k) { cap.dataset.k = k; cap.replaceChildren(h('div', {}, h('span', {}, MAPS[state.self.map].name), h('span', { class: 'mute num' }, `${state.boss.online} online`)), h('div', {}, h('span', { class: 'mute' }, 'World boss'), h('span', { class: `num ${state.boss.alive ? 'k-boss' : ''}` }, t))); }
  const b = [...state.ents.values()].find(t => t.e.boss && t.e.hp! < t.e.mhp! || t.e.boss && t.e.boss.st !== 'choose')?.e, el = $('boss'); el.hidden = !b; if (!b) return;
  const atk = b.boss!.st === 'windup' ? MONSTERS[b.type!].boss!.attacks.find(a => a.id === b.boss!.atk)!.name : '', key = `${b.hp}/${b.mhp}${atk}${state.boss.contrib}`; if (el.dataset.k === key) return; el.dataset.k = key;
  const world = MONSTERS[b.type!].boss!.world;
  el.replaceChildren(h('div', { class: 'row' }, h('h2', {}, MONSTERS[b.type!].name), h('span', { class: 'num' }, `${b.hp} / ${b.mhp}`)), h('div', { class: 'bar' }, h('i', { style: `width:${(100 * b.hp!) / b.mhp!}%` })), h('div', { class: 'row', style: 'margin:4px 0 0' }, h('small', {}, atk || ' '), world ? h('small', { class: 'num' }, `Contribution ${(state.boss.contrib * 100).toFixed(1)}%`) : null));
}
const gains = new Map<Skill, { n: number; el: HTMLElement; t: number }>();
function gain(s: Skill, n: number) { const d = document.getElementById('drops'); if (!d) return; const g = gains.get(s); if (g) { g.n += n; clearTimeout(g.t); } const el = g?.el ?? h('div', { class: 'num' }), o = { n: (g?.n ?? 0) + (g ? 0 : n), el, t: window.setTimeout(() => { el.remove(); gains.delete(s); }, 1800) }; el.textContent = `${s} +${o.n}`; if (!el.isConnected) d.append(el); gains.set(s, o); }
export function initUi() {
  onMsg((m: ServerMsg) => {
    switch (m.t) {
      case 'welcome': closePanel(); shell(); break;
      case 'error': { const e = document.querySelector('#login .err'); if (e) e.textContent = m.msg; else showLogin(m.msg); break; }
      case 'kicked': showLogin(m.msg); break;
      case 'self': side(); panel(); hint(); break;
      case 'chat': log(m.text, 'chat', m.from); break;
      case 'info': log(m.text, m.kind ?? 'info'); break;
      case 'xp': gain(m.skill, m.amount); break;
      case 'open': open = m.station; qty = 1; tier = Math.max(1, Math.min(5, tier)); panel(); side(); break;
      case 'snap': vitals(); hint(); bossUi(); if (open && state.self) { const s = MAPS[state.self.map].stations.find(s => s.type === open)!, me = state.ents.get(state.me)?.e; if (me && Math.max(Math.abs(me.x - s.x), Math.abs(me.y - s.y)) > 2) closePanel(); } break;
    }
  });
  onClosed(why => { if (why) log(why, 'bad'); else if (!document.getElementById('login')) showLogin('Disconnected.'); else { const e = document.querySelector('#login .err'); if (e && !e.textContent) e.textContent = 'Could not reach the server.'; } });
  showLogin(); if (hasToken()) resume();
  let last = 0; return (now: number) => { if (now - last > 60) { last = now; minimap(); bossUi(); } };
}
