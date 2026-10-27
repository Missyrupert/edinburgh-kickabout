// Level registry + selection. Order: ?level= URL param > saved choice > Pennywell Road (default for new players).
import grassmarket from './grassmarket.js';
import granton from './granton.js';
import newhaven from './newhaven.js';
import leith from './leith.js';
import pennywell from './pennywell.js';
import easterroad from './easterroad.js';
import portobello from './portobello.js';
import londonroad from './londonroad.js';
import stockbridge from './stockbridge.js';
import princesstreet from './princesstreet.js';
import royalmile from './royalmile.js';
import esplanade from './esplanade.js';
export const LEVELS = { pennywell, grassmarket, granton, newhaven, leith, easterroad, portobello, londonroad, stockbridge, princesstreet, royalmile, esplanade };
export const LEVEL_ORDER = ['pennywell', 'granton', 'newhaven', 'leith', 'portobello', 'easterroad', 'londonroad', 'stockbridge', 'princesstreet', 'grassmarket', 'royalmile', 'esplanade']; // v3.10: Chris's order. v3.14: all 12 streets open; West Pilton removed (tag pilton-archive)
LEVEL_ORDER.forEach((id, i) => { LEVELS[id].next = LEVEL_ORDER[(i + 1) % LEVEL_ORDER.length]; }); // travel button follows the order
const q = new URLSearchParams(location.search);
let saved = null; try { saved = localStorage.getItem('ek-level'); } catch {}
const fromUrl = q.get('level');
export const LEVEL = LEVELS[fromUrl] || LEVELS[saved] || LEVELS.pennywell; // v3.2: new players start at Pennywell; saved choices still load
try { localStorage.setItem('ek-level', LEVEL.id); } catch {}
export function travelTo(id) {
  try { localStorage.setItem('ek-level', id); } catch {}
  const u = new URL(location.href); u.searchParams.set('level', id); location.href = u.toString();
}
