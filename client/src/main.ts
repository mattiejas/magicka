import { GAME_NAME } from '@magicka/shared';
import { bindInput } from './input';
import { onMsg, state } from './net';
import { Scene } from './scene';
import { initUi } from './ui/ui';
document.title = GAME_NAME;
const canvas = document.getElementById('view') as HTMLCanvasElement, scene = new Scene(canvas, document.getElementById('overlay')!);
const keys = bindInput(canvas, scene), ui = initUi();
onMsg(m => { if (m.t === 'snap') for (const e of m.ev) scene.event(e); });
let last = performance.now();
function frame(now: number) { const dt = Math.min(0.1, (now - last) / 1000); last = now; keys(dt); scene.frame(dt); ui(now); requestAnimationFrame(frame); }
requestAnimationFrame(frame);
if (import.meta.env.DEV) Object.assign(window, { game: { state, scene } });
