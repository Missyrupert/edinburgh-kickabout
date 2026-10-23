// Level registry + selection. Order: ?level= URL param > saved choice > West Pilton (default for new players).
import grassmarket from './grassmarket.js';
import pilton from './pilton.js';
import granton from './granton.js';
import newhaven from './newhaven.js';
import leith from './leith.js';
export const LEVELS = { pilton, grassmarket, granton, newhaven, leith };
export const LEVEL_ORDER = ['pilton', 'grassmarket', 'granton', 'newhaven', 'leith'];
const q = new URLSearchParams(location.search);
let saved = null; try { saved = localStorage.getItem('ek-level'); } catch {}
const fromUrl = q.get('level');
export const LEVEL = LEVELS[fromUrl] || LEVELS[saved] || LEVELS.pilton;
try { localStorage.setItem('ek-level', LEVEL.id); } catch {}
export function travelTo(id) {
  try { localStorage.setItem('ek-level', id); } catch {}
  const u = new URL(location.href); u.searchParams.set('level', id); location.href = u.toString();
}
