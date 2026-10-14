// Experimental achievements (West Pilton challenges) + cosmetic rewards. Saved on the device.
const KEY = 'ek-unlocks';
export const BALLS = { tango: { name: 'Tango-style (default)' }, winter: { name: "1980s Winter Orange" } };
export const ITEMS = { mars: { name: 'Deep-fried Mars bar', pence: 120, line: "\"Deep-fried Mars bar, £1.20. Yer cardiologist's on line two.\"" } };
// which challenge unlocks what
export const REWARDS = { c_roof: { ball: 'winter', text: 'New ball: the 1980s Winter Orange (pick it in the pause menu)' }, c_window: { item: 'mars', text: 'The Pilton Plaice now sells Deep-fried Mars bars' }, c_longpoles: { cash: 200, text: 'Big-shot bonus: £2.00 pocket money' } };
function load() { try { const u = JSON.parse(localStorage.getItem(KEY)); if (u && u.done) return { done: u.done, balls: u.balls || ['tango'], ball: u.ball || 'tango', items: u.items || [], bought: u.bought || {} }; } catch {} return { done: {}, balls: ['tango'], ball: 'tango', items: [], bought: {} }; }
export const unlocks = load();
export function saveUnlocks() { try { localStorage.setItem(KEY, JSON.stringify(unlocks)); } catch {} }
// returns the reward the first time a challenge is completed, null afterwards (fires once)
export function completeChallenge(id) {
  if (unlocks.done[id]) return null;
  unlocks.done[id] = true; const r = REWARDS[id] || {};
  if (r.ball && !unlocks.balls.includes(r.ball)) unlocks.balls.push(r.ball);
  if (r.item && !unlocks.items.includes(r.item)) unlocks.items.push(r.item);
  saveUnlocks(); return r;
}
export function selectBall(id) { if (!unlocks.balls.includes(id)) return false; unlocks.ball = id; saveUnlocks(); return true; }
export function resetProgress() { unlocks.done = {}; unlocks.balls = ['tango']; unlocks.ball = 'tango'; unlocks.items = []; unlocks.bought = {}; saveUnlocks(); }
