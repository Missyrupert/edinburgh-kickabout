// Level registry + selection. Order: ?level= URL param > saved choice > West Pilton (default for new players).
import grassmarket from './grassmarket.js';
import pilton from './pilton.js';
import granton from './granton.js';
import newhaven from './newhaven.js';
import leith from './leith.js';
import pennywell from './pennywell.js';
import easterroad from './easterroad.js';
import portobello from './portobello.js';
import londonroad from './londonroad.js';
import royalmile from './royalmile.js';
import esplanade from './esplanade.js';
export const LEVELS = { pennywell, pilton, grassmarket, granton, newhaven, leith, easterroad, portobello, londonroad, royalmile, esplanade };
export const LEVEL_ORDER = ['pilton', 'pennywell', 'granton', 'newhaven', 'leith', 'portobello', 'easterroad', 'londonroad', 'grassmarket', 'royalmile', 'esplanade']; // v3.10: Chris's order (Stockbridge, no. 9, is a 'Coming soon' tile until it's built)
LEVEL_ORDER.forEach((id, i) => { LEVELS[id].next = LEVEL_ORDER[(i + 1) % LEVEL_ORDER.length]; }); // travel button follows the order
const q = new URLSearchParams(location.search);
let saved = null; try { saved = localStorage.getItem('ek-level'); } catch {}
const fromUrl = q.get('level');
export const LEVEL = LEVELS[fromUrl] || LEVELS[saved] || LEVELS.pilton; // v3.10: new players start in West Pilton (where it all began); saved choices still load
try { localStorage.setItem('ek-level', LEVEL.id); } catch {}
export function travelTo(id) {
  try { localStorage.setItem('ek-level', id); } catch {}
  const u = new URL(location.href); u.searchParams.set('level', id); location.href = u.toString();
}
