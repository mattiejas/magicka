// The settings window. A native dialog, which keeps the focus inside and closes on Escape.
import { changeSetting, type Settings, settings } from '../settings';
import { button, byId, h, uiRoot } from './dom';
import { closeMenu, hideTooltip } from './popups';

type Toggle = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: { setting: Toggle; label: string; description: string }[] = [
  {
    setting: 'showFps',
    label: 'FPS counter',
    description: 'Shows how many frames are drawn each second.',
  },
];

function toggleRow({ setting, label, description }: (typeof TOGGLES)[number]): HTMLElement {
  const checkbox = h('input', {
    type: 'checkbox',
    checked: settings()[setting],
    onchange: () => changeSetting(setting, checkbox.checked),
  }) as HTMLInputElement;
  return h('label', { class: 'setting' }, h('span', {}, label, h('small', {}, description)), checkbox);
}

export const isSettingsOpen = () => !!byId('settings');

export function openSettings() {
  if (isSettingsOpen()) return;
  closeMenu();
  hideTooltip();
  const dialog = h('dialog', {
    id: 'settings',
    class: 'panel',
    'aria-label': 'Settings',
    onclose: () => dialog.remove(),
    // The content fills the window, so only a click beside it lands on the dialog itself.
    onclick: (event: MouseEvent) => event.target === dialog && dialog.close(),
  }) as HTMLDialogElement;
  dialog.append(
    h(
      'div',
      { class: 'content' },
      h(
        'header',
        {},
        h('h2', {}, 'Settings'),
        button('Close', () => dialog.close()),
      ),
      h('div', { class: 'body' }, ...TOGGLES.map(toggleRow)),
    ),
  );
  uiRoot().append(dialog);
  dialog.showModal();
}
