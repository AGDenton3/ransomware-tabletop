// Landing page: scenario picker plus the live "incident console" in the hero.
import { initTheme } from './common.js';
import { renderPicker } from './picker.js';

initTheme();
const list = document.getElementById('scenario-list');
if (list) renderPicker(list);

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');

// Duplicate the ticker items so the loop is seamless.
const ticker = $('ticker');
if (ticker) ticker.innerHTML += ticker.innerHTML;

// Scramble the redacted word, then settle on "encrypted".
const scramble = $('scramble');
if (scramble && !reduce) {
  const target = scramble.textContent;
  const glyphs = '#%&$@*0123456789ABCDEF';
  let frame = 0;
  const id = setInterval(() => {
    frame++;
    scramble.textContent = [...target].map((ch, i) => (i < frame / 3 ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join('');
    if (frame / 3 >= target.length) { clearInterval(id); scramble.textContent = target; }
  }, 45);
}

// Live clock from 07:42:00 and a ransom countdown.
let seconds = 0;
let files = 1218;
function tick() {
  const t = 7 * 3600 + 42 * 60 + seconds;
  $('hero-clock').textContent = `${pad(Math.floor(t / 3600) % 24)}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`;
  const left = 72 * 3600 - 1 - seconds;
  $('hero-deadline').textContent = `${pad(Math.floor(left / 3600))}:${pad(Math.floor(left / 60) % 60)}:${pad(left % 60)}`;
  $('hero-files').textContent = files.toLocaleString('en-US');
}
if ($('hero-clock')) {
  tick();
  if (!reduce) setInterval(() => { seconds++; files += Math.floor(Math.random() * 9); tick(); }, 1000);
}
