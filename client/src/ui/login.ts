// The sign-in screen.
import { GAME_NAME } from '@driftwake/shared';
import { connect } from '../net/connection';
import { button, byId, h, uiRoot } from './dom';

let registering = false;

/** True once after an account was created, for a first-time welcome. */
export function takeJustRegistered(): boolean {
  const result = registering;
  registering = false;
  return result;
}

export const isLoginShown = () => !!byId('login');

export function showLogin(message = '') {
  const name = h('input', {
    name: 'name',
    autocomplete: 'username',
    maxlength: 16,
    required: true,
    pattern: '[A-Za-z0-9_]{3,16}',
    title: '3 to 16 letters, digits or underscores',
  }) as HTMLInputElement;
  const password = h('input', {
    name: 'pw',
    type: 'password',
    autocomplete: 'current-password',
    minlength: 8,
    maxlength: 128,
    required: true,
  }) as HTMLInputElement;
  const form = h('form') as HTMLFormElement;
  const submit = (type: 'login' | 'register') => {
    if (!form.reportValidity()) return;
    showLoginError('');
    registering = type === 'register';
    connect({ type, name: name.value, password: password.value });
  };
  form.append(
    h('h1', {}, GAME_NAME),
    h(
      'div',
      { class: 'mute' },
      'Gather, craft, build a boat, and bring friends for what waits on the mainland.',
    ),
    h('label', {}, 'Name', name),
    h('label', {}, 'Password, at least 8 characters', password),
    h('div', { class: 'err', role: 'alert' }, message),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'primary', type: 'submit' }, 'Log in'),
      button('Create account', () => submit('register')),
    ),
  );
  form.addEventListener('submit', event => {
    event.preventDefault();
    submit('login');
  });
  byId('overlay')!.replaceChildren();
  uiRoot().replaceChildren(h('div', { id: 'login', class: 'panel' }, form));
  name.focus();
}

const errorElement = () => document.querySelector('#login .err');
export const loginError = () => errorElement()?.textContent ?? '';
export function showLoginError(message: string) {
  const element = errorElement();
  if (element) element.textContent = message;
}
