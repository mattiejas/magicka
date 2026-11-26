// The settings window. A native dialog, which keeps the focus inside and closes on Escape.
import { send } from '../net/connection';
import { state } from '../net/state';
import { QUALITIES, QUALITY_LABEL, type Quality } from '../quality';
import { changeSetting, type LabelMode, type Settings, settings, UI_SCALES, type UiScale } from '../settings';
import { button, byId, h, uiRoot } from './dom';
import { setBlocked } from './players';
import { closeMenu, hideTooltip } from './popups';
import { onUiScale, uiScale } from './scale';

type Toggle = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: { setting: Toggle; label: string; description: string }[] = [
  {
    setting: 'questMarker',
    label: 'Quest marker',
    description: 'Marks on the minimap where to go for the current quest step.',
  },
  {
    setting: 'showFps',
    label: 'FPS counter',
    description: 'Shows how many frames are drawn each second.',
  },
];

const LABEL_MODES: { mode: LabelMode; label: string }[] = [
  { mode: 'all', label: 'All' },
  { mode: 'valuable', label: 'Valuable' },
  { mode: 'none', label: 'None' },
];

function toggleRow({ setting, label, description }: (typeof TOGGLES)[number]): HTMLElement {
  const checkbox = h('input', {
    type: 'checkbox',
    checked: settings()[setting],
    onchange: () => changeSetting(setting, checkbox.checked),
  }) as HTMLInputElement;
  return h('label', { class: 'setting' }, h('span', {}, label, h('small', {}, description)), checkbox);
}

function choiceGroup<T extends string>(
  ariaLabel: string,
  choices: { value: T; label: string }[],
  current: T,
  onChoose: (value: T) => void,
  dataKey: string,
): HTMLElement {
  const group = h('div', { class: 'choices', role: 'group', 'aria-label': ariaLabel });
  const setPressed = (value: T) => {
    for (const child of group.querySelectorAll('button')) {
      const on = child.dataset[dataKey] === value;
      child.classList.toggle('on', on);
      child.setAttribute('aria-pressed', String(on));
    }
  };
  for (const { value, label } of choices) {
    group.append(
      h(
        'button',
        {
          type: 'button',
          class: current === value ? 'on' : '',
          'aria-pressed': String(current === value),
          [`data-${dataKey}`]: value,
          onclick: () => {
            onChoose(value);
            setPressed(value);
          },
        },
        label,
      ),
    );
  }
  return group;
}

function qualityRow(): HTMLElement {
  return h(
    'div',
    { class: 'setting' },
    h(
      'span',
      {},
      'Graphics quality',
      h('small', {}, 'Lower draws fewer pixels, turns soft shadows off, and scatters less clutter.'),
    ),
    choiceGroup(
      'Graphics quality',
      QUALITIES.map(level => ({ value: level, label: QUALITY_LABEL[level] })),
      settings().quality,
      (level: Quality) => changeSetting('quality', level),
      'quality',
    ),
  );
}

const percent = (scale: number) => `${Math.round(scale * 100)}%`;

/** The scale choices, and a note while the window is too small for the chosen one. */
function scaleRow(): { row: HTMLElement; stop: () => void } {
  const note = h('small', { class: 'scale-note' });
  const showNote = () => {
    const limited = uiScale() < settings().uiScale;
    note.hidden = !limited;
    note.textContent = limited ? `This window fits ${percent(uiScale())}.` : '';
  };
  showNote();
  const row = h(
    'div',
    { class: 'setting' },
    h('span', {}, 'Interface size', h('small', {}, 'Panels, menus and names over the world.'), note),
    choiceGroup(
      'Interface size',
      UI_SCALES.map(scale => ({ value: String(scale), label: percent(scale) })),
      String(settings().uiScale),
      value => {
        changeSetting('uiScale', Number(value) as UiScale);
        showNote();
      },
      'scale',
    ),
  );
  return { row, stop: onUiScale(showNote) };
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

function labelRows(): HTMLElement[] {
  const threshold = h('input', {
    type: 'number',
    class: 'threshold',
    min: '0',
    step: '1',
    value: String(settings().labelThreshold),
    'aria-label': 'Valuable threshold in coins',
    onchange: () => {
      const n = Number((threshold as HTMLInputElement).value);
      if (Number.isFinite(n) && n >= 0) changeSetting('labelThreshold', Math.floor(n));
      else (threshold as HTMLInputElement).value = String(settings().labelThreshold);
    },
  });
  return [
    h(
      'div',
      { class: 'setting' },
      h(
        'span',
        {},
        'Ground labels',
        h('small', {}, 'Names above items on the ground. Hold Alt to show every label.'),
      ),
      choiceGroup(
        'Ground labels',
        LABEL_MODES.map(({ mode, label }) => ({ value: mode, label })),
        settings().labelMode,
        (mode: LabelMode) => changeSetting('labelMode', mode),
        'mode',
      ),
    ),
    h(
      'label',
      { class: 'setting' },
      h(
        'span',
        {},
        'Valuable threshold',
        h('small', {}, 'Shop value in coins. Uniques are always labelled.'),
      ),
      threshold,
    ),
  ];
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
  const scale = scaleRow();
  const dialog = h('dialog', {
    id: 'settings',
    class: 'panel',
    'aria-label': 'Settings',
    onclose: () => {
      scale.stop();
      dialog.remove();
    },
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
        scale.row,
        qualityRow(),
        ...labelRows(),
        ...TOGGLES.map(toggleRow),
        ...passwordSection(),
        ...blockedPlayers(),
      ),
    ),
  );
  uiRoot().append(dialog);
  dialog.showModal();
}
