// The chat box, which also shows messages from the game.
import type { InfoKind } from '@magicka/shared';
import { send } from '../net/connection';
import { byId, h } from './dom';

const MAX_LINES = 120;
const MAX_LENGTH = 160;

export function chatBox(): HTMLElement {
  const input = h('input', {
    id: 'chat-in',
    placeholder: 'Enter to chat',
    'aria-label': 'Chat',
    maxlength: MAX_LENGTH,
    onkeydown: (event: KeyboardEvent) => handleKey(event, input),
  }) as HTMLInputElement;
  return h('div', { id: 'chat', class: 'panel' }, h('div', { class: 'log', 'aria-live': 'polite' }), input);
}

function handleKey(event: KeyboardEvent, input: HTMLInputElement) {
  if (event.key === 'Enter') {
    const text = input.value.trim();
    if (text) send({ type: 'chat', text });
    input.value = '';
    input.blur();
  }
  if (event.key === 'Escape') input.blur();
}

export const focusChat = () => byId('chat-in')?.focus();

export function showChat(from: string, text: string) {
  addLine('chat', h('b', {}, `${from}: `), text);
}

export function showInfo(text: string, kind: InfoKind | 'info' = 'info') {
  addLine(kind, text);
}

function addLine(kind: string, ...content: (Node | string)[]) {
  const log = document.querySelector('#chat .log');
  if (!log) return;
  log.append(h('div', { class: `k-${kind}` }, ...content));
  while (log.children.length > MAX_LINES) log.firstChild!.remove();
  log.scrollTop = log.scrollHeight;
}
