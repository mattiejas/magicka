import { ITEMS } from '@magicka/shared';

const P: Record<string, string> = {
  pickaxe:
    '<path d="M16 6l2 2L6 21l-2-2z" fill="#8a6b48"/><path d="M7 3q9-1 14 14q-5-8-10-10q-4-2-8-1z" fill="C"/>',
  axe: '<path d="M14 4l2 2L6 22l-2-2z" fill="#8a6b48"/><path d="M12 5l4-3q5 1 6 10q-4-2-8 0l-4-3z" fill="C"/>',
  sword:
    '<path d="M19 3 L21 5 L10 16 L8 14Z" fill="C"/><path d="M5 13l6 6-2 1-5-5zM3 19l3-3 2 2-3 3z" fill="#8a6b48"/>',
  bow: '<path d="M6 3 Q21 12 6 21 L8 21 Q25 12 8 3Z" fill="C"/><path d="M6 3h1v18H6z" fill="#d9d2c0"/>',
  staff: '<path d="M4 20 L15 9 L17 11 L6 22Z" fill="C"/><path d="M18 2l4 4-4 5-4-5z" fill="#8fb8d8"/>',
  helm: '<path d="M5 19V9l4-5h6l4 5v10h-4v-6H9v6z" fill="C"/>',
  body: '<path d="M3 6l5-2 4 2 4-2 5 2-2 6h-2v8H7v-8H5z" fill="C"/>',
  legs: '<path d="M6 3h12v18h-4l-2-11-2 11H6z" fill="C"/>',
  arrowhead: '<path d="M12 3l6 16-6-4-6 4z" fill="C"/>',
  shaft: '<path d="M4 20L19 5l1 1L5 21zM7 21L21 8l1 1L8 22z" fill="C"/>',
  arrow:
    '<path d="M5 18L16 7l1 1L6 19z" fill="#b39a72"/><path d="M21 3l-2 9-7-7z" fill="C"/><path d="M3 17l4 4-4 0z" fill="#d9d2c0"/>',
  ore: '<path d="M4 18l2-9 6-5 7 4 2 9-7 4z" fill="#7d7a74"/><path d="M8 10l4-2 1 4-3 2zM14 13l4-1-1 4-3 1z" fill="C"/>',
  bar: '<path d="M6 8h12l4 10H2z" fill="C"/><path d="M6 8h12l1 3H5z" fill="#fff" opacity=".25"/>',
  log: '<path d="M2 9h15v8H2z" fill="C"/><path d="M15 9h6v8h-6z" fill="#e0cca0"/><path d="M17 12h2v2h-2z" fill="C"/>',
  hide: '<path d="M5 4l4 2h6l4-2 1 6-2 4 2 6-5-1-3 2-3-2-5 1 2-6-2-4z" fill="C"/>',
  fibre:
    '<path d="M6 21Q4 10 9 3l1 1Q7 12 9 21zM11 21Q11 10 12 2l1 0Q15 12 13 21zM15 21Q18 12 16 4l1-1q4 9 1 18z" fill="C"/>',
  gem: '<path d="M7 4h10l5 6-10 11L2 10z" fill="C"/><path d="M7 4h10l-5 6z" fill="#fff" opacity=".35"/>',
  amulet:
    '<path d="M5 3l7 11 7-11 1 1-7 12h-2L4 4z" fill="#b99a5a"/><path d="M12 13l4 4-4 5-4-5z" fill="C"/>',
  essence: '<path d="M12 2l5 10-5 10-5-10z" fill="C"/><path d="M12 2l5 10h-5z" fill="#fff" opacity=".3"/>',
  berries:
    '<path d="M5 10h6v6H5zM13 9h6v6h-6zM9 15h6v6H9z" fill="C"/><path d="M11 3h2v7h-2z" fill="#6f8a52"/>',
  meat: '<path d="M4 8l7-4 8 4 1 7-7 5-8-3z" fill="C"/><path d="M10 10h4v4h-4z" fill="#ecdcc8"/>',
  ration: '<path d="M3 11h18l-3 9H6z" fill="C"/><path d="M6 6h5v4H6zM13 5h5v5h-5z" fill="#a8685a"/>',
  wheel:
    '<path d="M12 4a8 8 0 1 0 .01 0zM12 7a5 5 0 1 1-.01 0z" fill="C" fill-rule="evenodd"/><path d="M11 0h2v24h-2zM0 11h24v2H0z" fill="#6d5f48"/><path d="M10 10h4v4h-4z" fill="C"/>',
};
export const icon = (id: string) => {
  const i = ITEMS[id];
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[i.icon].replaceAll('"C"', `"${i.color}"`)}${i.unique ? '<path d="M0 0h6L0 6z" fill="#d9b25b"/>' : ''}</svg>`;
};
