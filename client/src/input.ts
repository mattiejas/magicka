import { MAPS, MONSTERS, NODES, walkable } from '@magicka/shared';
import { send, state } from './net';
import type { Pick, Scene } from './scene';
import { closeMenu, closePanel, menu, tooltip } from './ui/ui';
const verb = (p: Pick): [string, () => void] | null => {
  if (p.kind === 'node') { const k = NODES[p.type].kind; return [k === 'rock' ? 'Mine' : k === 'tree' ? 'Chop' : 'Pick', () => send({ t: 'gather', id: p.id })]; }
  if (p.kind === 'station') return ['Use', () => send({ t: 'station', id: p.id })];
  if (p.e!.k === 'm') return ['Attack', () => send({ t: 'attack', id: p.id })];
  if (p.e!.k === 'd') return ['Take', () => send({ t: 'pickup', id: p.id })];
  if (p.e!.k === 'g') return ['Recover', () => send({ t: 'grave' })];
  return null;
};
const label = (p: Pick) => p.name + (p.kind === 'ent' && p.e!.k === 'm' ? `  level ${MONSTERS[p.type].level}` : p.kind === 'node' && NODES[p.type].skill ? `  ${NODES[p.type].skill} ${NODES[p.type].level}` : '');
export function bindInput(canvas: HTMLCanvasElement, scene: Scene) {
  let drag: [number, number] | null = null; const keys = new Set<string>();
  const walk = (t: [number, number] | null) => { if (!t || !state.self) return; if (walkable(MAPS[state.self.map], ...t)) scene.marker(...t); send({ t: 'move', x: t[0], y: t[1] }); };
  canvas.addEventListener('mousedown', ev => {
    closeMenu(); (document.activeElement as HTMLElement | null)?.blur();
    if (ev.button === 1) { drag = [ev.clientX, ev.clientY]; ev.preventDefault(); return; }
    if (ev.button !== 0) return; closePanel();
    const { hits, tile } = scene.pick(ev.clientX, ev.clientY), act = hits.map(verb).find(Boolean); if (act) act[1](); else walk(tile);
  });
  canvas.addEventListener('contextmenu', ev => { ev.preventDefault(); const { hits, tile } = scene.pick(ev.clientX, ev.clientY); const items: [string, () => void][] = []; for (const h of hits) { const v = verb(h); if (v) items.push([`${v[0]} ${label(h)}`, v[1]]); } if (tile) items.push(['Walk here', () => walk(tile)]); menu(ev.clientX, ev.clientY, items); });
  addEventListener('mousemove', ev => { if (drag) { scene.yaw -= (ev.clientX - drag[0]) * 0.006; scene.pitch = Math.max(0.45, Math.min(1.35, scene.pitch + (ev.clientY - drag[1]) * 0.005)); drag = [ev.clientX, ev.clientY]; } });
  addEventListener('mouseup', () => { drag = null; });
  canvas.addEventListener('mousemove', ev => { const { hits, tile } = scene.pick(ev.clientX, ev.clientY); const h = hits.find(verb); scene.setHover(h ? null : tile); canvas.style.cursor = h ? 'pointer' : 'default'; tooltip(h ? `${verb(h)![0]} ${label(h)}` : '', ev.clientX, ev.clientY); });
  canvas.addEventListener('mouseleave', () => { scene.setHover(null); tooltip('', 0, 0); });
  canvas.addEventListener('wheel', ev => { ev.preventDefault(); scene.dist = Math.max(7, Math.min(26, scene.dist * Math.exp(ev.deltaY * 0.001))); }, { passive: false });
  addEventListener('keydown', ev => { if (ev.target instanceof HTMLInputElement) return; keys.add(ev.key); if (ev.key === 'Escape') { closeMenu(); closePanel(); } if (ev.key === 'Enter' && state.me) { document.getElementById('chat-in')?.focus(); ev.preventDefault(); } });
  addEventListener('keyup', ev => keys.delete(ev.key)); addEventListener('blur', () => keys.clear());
  return (dt: number) => { if (keys.has('ArrowLeft')) scene.yaw -= dt * 2; if (keys.has('ArrowRight')) scene.yaw += dt * 2; if (keys.has('ArrowUp')) scene.pitch = Math.min(1.35, scene.pitch + dt); if (keys.has('ArrowDown')) scene.pitch = Math.max(0.45, scene.pitch - dt); };
}
