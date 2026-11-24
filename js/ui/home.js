// Landing page: scenario picker.
import { initTheme } from './common.js';
import { renderPicker } from './picker.js';

initTheme();
const list = document.getElementById('scenario-list');
if (list) renderPicker(list);
