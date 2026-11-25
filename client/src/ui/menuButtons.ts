// The buttons under the minimap: hair, settings and log out.
import { logout } from '../net/connection';
import { h } from './dom';
import { type MenuIcon, menuIconUrl } from './icons/menu';
import { showLogin } from './login';
import { togglePanel } from './panels';
import { hideTooltip, showTooltip } from './popups';
import { openSettings } from './settingsModal';

const BUTTONS: { icon: MenuIcon; label: string; action: () => void }[] = [
  { icon: 'hair', label: 'Hair', action: () => togglePanel('hair') },
  { icon: 'settings', label: 'Settings', action: openSettings },
  { icon: 'logout', label: 'Log out', action: leave },
];

export const menuButtons = () => h('div', { class: 'menu-btns' }, ...BUTTONS.map(menuButton));

function menuButton({ icon, label, action }: (typeof BUTTONS)[number]): HTMLElement {
  const element = h(
    'button',
    {
      type: 'button',
      'aria-label': label,
      onclick: () => {
        hideTooltip();
        action();
      },
      onmousemove: (event: MouseEvent) => showTooltip(label, event.clientX, event.clientY),
      onmouseleave: hideTooltip,
      onblur: hideTooltip,
      // Keyboard users get the same tooltip, under the button.
      onfocus: () => {
        if (!element.matches(':focus-visible')) return;
        const box = element.getBoundingClientRect();
        showTooltip(label, box.left, box.bottom);
      },
    },
    h('img', { src: menuIconUrl(icon), alt: '', draggable: 'false' }),
  );
  return element;
}

function leave() {
  logout();
  showLogin();
}
