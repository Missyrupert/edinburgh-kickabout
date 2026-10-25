// PHASE 5 "One More Shot": tiers, cosmetic unlocks and chippy menu. Saved on the device (localStorage 'ek-unlocks').
// Tiers: easy = 'The Wee Warm-Up', tricky = 'Getting Cocky', legend = 'Away Ye Go!' (hidden optional challenges).
import { loadRecord, saveRecord, isObj, strArr, nat } from './save.js';
const KEY = 'ek-unlocks';
export const TIERS = { easy: 'The Wee Warm-Up', tricky: 'Cocky', legend: 'Away Ye Go!' };
export const BALLS = { tango: { name: 'Starter' }, winter: { name: 'Street Legend', how: 'Hit 3 Cocky targets' }, special: { name: 'The Pilton Special', how: 'All 3 Away Ye Go! shots' } };
export const BOOTS = { trainers: { name: 'Scuffed trainers' }, boots: { name: 'Classic black boots', how: 'All 3 Away Ye Go! shots' } };
export const ITEMS = {
  wee: { name: 'The Wee Supper', pence: 200, line: '"Wee bag o\' chips an\' a can. Dinnae fill yersel up."' },
  supper: { name: "Fish supper + a can o' ginger", pence: 650 },
  munchie: { name: 'The Legendary Munchie Box', pence: 500, line: '"Doner, chips, pakora, onion rings, garlic sauce. Ye\'ll no\' sleep tonight."', how: 'Any Away Ye Go! shot' },
};
const fresh = () => ({ levels: {}, balls: ['tango'], ball: 'tango', boots: 'trainers', bootsOwned: ['trainers'], items: ['wee', 'supper'], bought: {} });
function sanitise(u) { // v3.9.1: shape/type checks; anything wrong is replaced by the default and flagged
  if (!isObj(u)) return null; const f = fresh(); let damaged = false; const bad = () => { damaged = true; };
  const out = { ...f };
  if (u.levels !== undefined) { if (isObj(u.levels)) { for (const [lv, d] of Object.entries(u.levels)) { if (!isObj(d)) { bad(); continue; } const keep = {}; for (const [id, v] of Object.entries(d)) { if (v === true) keep[id] = true; else bad(); } out.levels[lv] = keep; } } else bad(); }
  for (const k of ['balls', 'bootsOwned', 'items']) if (u[k] !== undefined) { if (strArr(u[k])) out[k] = [...new Set([...f[k], ...u[k]])]; else bad(); }
  if (u.ball !== undefined) { if (typeof u.ball === 'string' && out.balls.includes(u.ball)) out.ball = u.ball; else bad(); }
  if (u.boots !== undefined) { if (typeof u.boots === 'string' && out.bootsOwned.includes(u.boots)) out.boots = u.boots; else bad(); }
  if (u.bought !== undefined) { if (isObj(u.bought)) { for (const [k, v] of Object.entries(u.bought)) { const n = nat(v); if (n === null) bad(); else out.bought[k] = n; } } else bad(); }
  return { value: out, damaged };
}
function load() { return loadRecord(KEY, sanitise, fresh, 'progress'); }
export const unlocks = load();
export function saveUnlocks() { return saveRecord(KEY, unlocks, 'progress'); }
export const levelDone = (lv) => (unlocks.levels[lv] ||= {});
export function tierCount(lv, targets, tier) { const d = levelDone(lv); return targets.filter((t) => t.tier === tier && d[t.id]).length; }
// record a completion; returns a list of new unlocks (each fires once, ever)
export function recordDone(lv, t, all) {
  const d = levelDone(lv); const first = !d[t.id]; d[t.id] = true; const news = [];
  const add = (list, id, text) => { if (!list.includes(id)) { list.push(id); news.push({ id, text }); } };
  const legends = all.filter((x) => x.tier === 'legend'), tricky = all.filter((x) => x.tier === 'tricky');
  if (tricky.filter((x) => d[x.id]).length >= 3) add(unlocks.balls, 'winter', 'Ball unlocked: Street Legend');
  if (legends.some((x) => d[x.id])) add(unlocks.items, 'munchie', 'The Pilton Plaice now does The Legendary Munchie Box');
  if (legends.length && legends.every((x) => d[x.id])) { add(unlocks.balls, 'special', 'Ball unlocked: The Pilton Special'); add(unlocks.bootsOwned, 'boots', 'Classic black boots unlocked'); }
  saveUnlocks(); return { first, news };
}
export function selectBall(id) { if (!unlocks.balls.includes(id)) return false; unlocks.ball = id; saveUnlocks(); return true; }
export function selectBoots(id) { if (!unlocks.bootsOwned.includes(id)) return false; unlocks.boots = id; saveUnlocks(); return true; }
export function resetProgress() { Object.assign(unlocks, fresh()); saveUnlocks(); }
