// Small helpers for building DOM.
type Child = Node | string | null | false | undefined;
type Props = Record<string, unknown>;

/** Creates an element. `on…` props become listeners; `html` sets markup and must never hold user text. */
export function h(tag: string, props: Props = {}, ...children: Child[]): HTMLElement {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) setProp(element, name, value);
  for (const child of children) if (child) element.append(child);
  return element;
}

function setProp(element: HTMLElement, name: string, value: unknown) {
  if (value === false || value == null) return;
  if (name === 'html') element.innerHTML = value as string;
  else if (name.startsWith('on')) element.addEventListener(name.slice(2), value as EventListener);
  else element.setAttribute(name, value === true ? '' : String(value));
}

export const button = (label: string, onClick: () => void, props: Props = {}) =>
  h('button', { type: 'button', onclick: onClick, ...props }, label);

export const byId = (id: string): HTMLElement | null => document.getElementById(id);
export const uiRoot = () => byId('ui')!;

const lastKeys = new WeakMap<HTMLElement, string>();
/** Runs `render` only when `key` differs from the last time, so unchanged panels are left alone. */
export function renderIfChanged(element: HTMLElement, key: string, render: () => Node[]) {
  if (lastKeys.get(element) === key) return;
  lastKeys.set(element, key);
  element.replaceChildren(...render());
}

/** A horizontal bar filled to a share between 0 and 1. */
export const bar = (share: number, className = '') =>
  h('div', { class: `bar ${className}` }, h('i', { style: `width:${share * 100}%` }));
