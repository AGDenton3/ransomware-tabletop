// Hand-drawn inline SVG icons. Written in-house: thick, slightly uneven strokes.
// All use currentColor, so they take the colour of the text around them.

const S = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';

const PATHS = {
  // envelope, a little lopsided
  mail: `<path ${S} d="M4.5 8.2 L27.8 7.4 L28.3 24.6 L4 25.1 Z"/><path ${S} d="M5 8.6 C10 13 13 16.2 16.3 17.1 C19.6 16 23 12.6 27.4 8"/>`,
  // old handset
  phone: `<path ${S} d="M8.2 4.6 C6 5.4 4.4 7.6 5 10.6 C6.6 18.2 13.6 25.6 21.6 27.2 C24.4 27.7 26.6 26.2 27.4 24 L23.2 19.8 C22 19 20.8 19.4 19.9 20.6 C16.7 19.6 12.6 15.6 11.5 12.2 C12.7 11.3 13 10 12.3 8.9 Z"/>`,
  // speech bubble
  chat: `<path ${S} d="M5.2 7 C5 5.6 6 4.8 7.4 4.9 L25.2 4.5 C26.7 4.5 27.6 5.5 27.5 7 L27.2 18.6 C27.1 20 26.1 20.8 24.8 20.8 L13.6 21 L7.8 26.6 L8.4 21.2 L7.2 21.1 C5.9 21 5.1 20 5.1 18.6 Z"/><path ${S} d="M10.5 11.4 H22.2 M10.8 15.6 H18.4"/>`,
  // folded newspaper
  news: `<path ${S} d="M7.6 5.2 L27.6 4.8 L27.2 25.8 C27.2 27 26.2 27.6 25.2 27.5 L6.4 27.6 C5 27.6 4.2 26.6 4.3 25.3 L4.6 12.4 L7.4 12.6 Z"/><path ${S} d="M11.4 10.2 H23.6 M11.6 15 H17 M11.6 19.6 H23.2 M20.6 14.6 H23.4"/>`,
  // broken padlock (attacker portal)
  portal: `<path ${S} d="M6.6 14.2 L25.8 13.6 L26.2 27.4 L6.2 27.8 Z"/><path ${S} d="M10.4 13.8 L10.6 9.6 C10.8 6.2 13.2 4.4 16.4 4.6 C19.6 4.8 21.4 6.8 21.6 9.4"/><path ${S} d="M14.6 19 L17.4 21.6 L15.2 24.2"/>`,
  // tick
  check: `<path ${S} d="M5 16.6 L12.4 23.8 L27.4 7.6"/>`,
  // wall clock
  clock: `<path ${S} d="M16.2 4.4 C23 4.2 27.8 9.4 27.6 16.2 C27.4 22.8 22.6 27.8 15.8 27.6 C9.2 27.4 4.4 22.4 4.6 15.8 C4.8 9.2 9.6 4.6 16.2 4.4 Z"/><path ${S} d="M16 9.2 L16.2 16.4 L21.2 19.2"/>`,
  // fry basket (used for the checklist)
  basket: `<path ${S} d="M5 12.6 L27.2 12.2 L24.6 26.8 L7.8 27.2 Z"/><path ${S} d="M10.6 12.4 L11.6 6.2 M15.8 12.4 L16.2 4.8 M21 12.3 L20.6 6.6 M12.2 17.4 L20.6 17.2"/>`,
};

/** Decorative shapes: filled, not stroked. */
const SHAPES = {
  // 12-point atomic starburst with uneven rays
  starburst: `<path fill="currentColor" d="M50 2 L57 30 L80 10 L68 37 L98 34 L72 52 L96 70 L66 66 L76 94 L54 72 L46 98 L41 70 L18 90 L30 63 L2 66 L27 50 L4 30 L33 37 L22 8 L44 29 Z"/>`,
  // orbit rings around a nucleus
  orbit: `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"><ellipse cx="50" cy="50" rx="46" ry="16" transform="rotate(-20 50 50)"/><ellipse cx="50" cy="50" rx="46" ry="16" transform="rotate(40 50 50)"/><ellipse cx="50" cy="50" rx="46" ry="16" transform="rotate(100 50 50)"/></g><circle cx="50" cy="50" r="8" fill="currentColor"/>`,
  // googie boomerang
  boomerang: `<path fill="currentColor" d="M6 70 C24 30 52 14 94 12 C70 24 58 36 52 58 C44 50 30 54 6 70 Z"/>`,
};

export function icon(name, { label = '', size = 22, className = '' } = {}) {
  const body = PATHS[name];
  if (!body) return '';
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon ${className}" viewBox="0 0 32 32" width="${size}" height="${size}" ${a11y}>${body}</svg>`;
}

export function shape(name, { className = '', size = 100 } = {}) {
  const body = SHAPES[name];
  if (!body) return '';
  return `<svg class="shape ${className}" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** Inline markup for static HTML (copied verbatim into pages). */
export const RAW = { PATHS, SHAPES, S };
