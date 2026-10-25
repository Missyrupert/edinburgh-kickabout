// Pocket money: pence earned per target (by difficulty) + a small accuracy bonus. Saved on the device.
// The goal is purely cosmetic: a chippy supper and a can o' ginger. No shops, inventory or upgrades.
import { loadRecord, saveRecord, isObj, nat } from './save.js';
const KEY = 'ek-wallet';
export const GOAL = { pence: 650, label: 'Chippy an\' a can o\' ginger' };
export const BONUS = 25;
export const fmt = (p) => '£' + (p / 100).toFixed(2);
const freshW = () => ({ pence: 0, goalSeen: false, suppers: 0, total: 0 });
function sanitise(w) { if (!isObj(w)) return null; const out = freshW(); let damaged = false;
  for (const k of ['pence', 'suppers', 'total']) if (w[k] !== undefined) { const n = nat(w[k]); if (n === null) damaged = true; else out[k] = n; }
  if (w.goalSeen !== undefined) { if (typeof w.goalSeen === 'boolean') out.goalSeen = w.goalSeen; else damaged = true; }
  return { value: out, damaged }; }
function load() { return loadRecord(KEY, sanitise, freshW, 'pocket money'); }
export const wallet = load();
// v2.0.1 migration: old saves kept pocket money from every earlier session (and Reset progress never cleared it),
// so the chippy could fire after one target. Cap carried-over money once and re-arm the goal.
try { if (localStorage.getItem('ek-wallet-v') !== '2') { wallet.pence = Math.min(wallet.pence, 200); wallet.goalSeen = false; saveWallet(); localStorage.setItem('ek-wallet-v', '2'); } } catch {}
export function saveWallet() { return saveRecord(KEY, wallet, 'pocket money'); }
// v2.0.1: the chippy is an end-of-level reward - needs CHIPPY_TARGETS of the 8 Pilton targets bagged AND the cash.
export const CHIPPY_TARGETS = 7;
export function earn(p, earned = false) { wallet.pence += p; wallet.total += p; saveWallet(); const reached = !wallet.goalSeen && earned && wallet.pence >= GOAL.pence; if (reached) { wallet.goalSeen = true; saveWallet(); } return reached; }
export function buySupper() { if (wallet.pence < GOAL.pence) return false; wallet.pence -= GOAL.pence; wallet.suppers++; wallet.goalSeen = false; saveWallet(); return true; }
export function resetWallet() { wallet.pence = 0; wallet.goalSeen = false; wallet.suppers = 0; wallet.total = 0; saveWallet(); }
// default cash by difficulty for targets that don't set one (Grassmarket points -> pence)
export const cashFor = (t) => t.cash ?? Math.round(t.points * 0.5);
