// The settings window. A native dialog, which keeps the focus inside and closes on Escape.
import { send } from '../net/connection';
import { state } from '../net/state';
import { QUALITIES, QUALITY_LABEL, type Quality } from '../quality';
import { changeSetting, type Settings, settings } from '../settings';
import { button, byId, h, uiRoot } from './dom';
import { setBlocked } from './players';
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

function qualityRow(): HTMLElement {
  const choices = h('div', { class: 'choices', role: 'group', 'aria-label': 'Graphics quality' });
  const setPressed = (level: Quality) => {
    for (const child of choices.querySelectorAll('button')) {
      const on = child.dataset.quality === level;
      child.classList.toggle('on', on);
      child.setAttribute('aria-pressed', String(on));
    }
  };
  for (const level of QUALITIES) {
    choices.append(
      h(
        'button',
        {
          type: 'button',
          class: settings().quality === level ? 'on' : '',
          'aria-pressed': String(settings().quality === level),
          'data-quality': level,
          onclick: () => {
            changeSetting('quality', level);
            setPressed(level);
          },
        },
        QUALITY_LABEL[level],
      ),
    );
  }
  return h(
    'div',
    { class: 'setting' },
    h(
      'span',
      {},
      'Graphics quality',
      h('small', {}, 'Lower draws fewer pixels, turns soft shadows off, and scatters less clutter.'),
    ),
    choices,
  );
}

function passwordField(label: string, autocomplete: string): HTMLInputElement {
  return h('input', {
    type: 'password',
    autocomplete,
    minlength: 8,
    maxlength: 128,
    required: true,
    'aria-label': label,
  }) as HTMLInputElement;
}

function passwordSection(): HTMLElement[] {
  const oldPassword = passwordField('Current password', 'current-password');
  const newPassword = passwordField('New password', 'new-password');
  const status = h('p', { class: 'mute', role: 'status', id: 'password-status' });
  const form = h('form', { class: 'password-form' }) as HTMLFormElement;
  form.append(
    h('label', {}, 'Current password', oldPassword),
    h('label', {}, 'New password, at least 8 characters', newPassword),
    status,
    h('button', { class: 'primary', type: 'submit' }, 'Change password'),
  );
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.textContent = '';
    send({ type: 'changePassword', oldPassword: oldPassword.value, newPassword: newPassword.value });
    form.dataset.awaiting = '1';
  });
  return [h('h2', { class: 'section' }, 'Password'), form];
}

function blockedPlayers(): HTMLElement[] {
  const names = state.self?.blocked ?? [];
  if (!names.length) return [];
  const rows = names.map(name => {
    const row = h('div', { class: 'setting' }, h('span', {}, name));
    const unblock = () => {
      setBlocked(name, false);
      row.remove();
    };
    row.append(button('Unblock', unblock));
    return row;
  });
  return [h('h2', { class: 'section' }, 'Blocked players'), ...rows];
}

export const isSettingsOpen = () => !!byId('settings');

/** Fills the password form status when the server replies after a change. */
export function passwordChangeReply(text: string) {
  const form = document.querySelector('#settings .password-form') as HTMLFormElement | null;
  if (!form?.dataset.awaiting) return;
  delete form.dataset.awaiting;
  const status = byId('password-status');
  if (status) status.textContent = text;
  if (text === 'Password changed.') {
    for (const input of form.querySelectorAll('input')) (input as HTMLInputElement).value = '';
  }
}

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
      h(
        'div',
        { class: 'body' },
        qualityRow(),
        ...TOGGLES.map(toggleRow),
        ...passwordSection(),
        ...blockedPlayers(),
      ),
    ),
  );
  uiRoot().append(dialog);
  dialog.showModal();
}
