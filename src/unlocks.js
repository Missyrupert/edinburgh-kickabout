// PHASE 5 "One More Shot": tiers, cosmetic unlocks and chippy menu. Saved on the device (localStorage 'ek-unlocks').
// Tiers: easy = 'The Wee Warm-Up', tricky = 'Getting Cocky', legend = 'Away Ye Go!' (hidden optional challenges).
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
function load() { try { const u = JSON.parse(localStorage.getItem(KEY)); if (u && u.levels) return { ...fresh(), ...u }; } catch {} return fresh(); }
export const unlocks = load();
export function saveUnlocks() { try { localStorage.setItem(KEY, JSON.stringify(unlocks)); } catch {} }
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
