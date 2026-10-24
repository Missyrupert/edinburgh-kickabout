// Level registry + selection. Order: ?level= URL param > saved choice > Pennywell Road (default for new players).
import grassmarket from './grassmarket.js';
import pilton from './pilton.js';
import granton from './granton.js';
import newhaven from './newhaven.js';
import leith from './leith.js';
import pennywell from './pennywell.js';
import easterroad from './easterroad.js';
export const LEVELS = { pennywell, pilton, grassmarket, granton, newhaven, leith, easterroad };
export const LEVEL_ORDER = ['pennywell', 'pilton', 'granton', 'newhaven', 'leith', 'easterroad', 'grassmarket']; // v3.5: Easter Road between Leith and the Grassmarket
const q = new URLSearchParams(location.search);
let saved = null; try { saved = localStorage.getItem('ek-level'); } catch {}
const fromUrl = q.get('level');
export const LEVEL = LEVELS[fromUrl] || LEVELS[saved] || LEVELS.pennywell; // v3.2: new players start at Pennywell; saved choices still load
try { localStorage.setItem('ek-level', LEVEL.id); } catch {}
export function travelTo(id) {
  try { localStorage.setItem('ek-level', id); } catch {}
  const u = new URL(location.href); u.searchParams.set('level', id); location.href = u.toString();
}
