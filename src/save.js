// v3.9.1: safe saves. Every record is validated + sanitised on load; a damaged record is never thrown away - it is kept under
// '<key>-corrupt-<timestamp>' and the last good copy ('<key>-bak') is used if it is valid. Problems are queued as short,
// non-blocking notices for the HUD (shown once the game is up). Storage failures (private mode, quota) are reported once.
export const notices = [];
let listener = null, warnedWrite = false;
export function onNotice(fn) { listener = fn; while (notices.length) fn(notices.shift()); }
function notify(msg) { if (listener) listener(msg); else notices.push(msg); }
const ls = () => { try { return window.localStorage; } catch { return null; } };
function preserve(store, key, raw) { try { store.setItem(`${key}-corrupt-${Date.now()}`, raw); } catch {} }
// sanitise(parsed) -> { value, damaged } or null if unusable
export function loadRecord(key, sanitise, fresh, label) {
  const store = ls(); if (!store) { notify(`Saves are switched off on this browser - ${label} won't be kept.`); return fresh(); }
  let raw = null; try { raw = store.getItem(key); } catch { notify(`Couldnae read yer saved ${label}.`); return fresh(); }
  const tryParse = (s) => { if (s == null) return null; try { return sanitise(JSON.parse(s)); } catch { return null; } };
  if (raw == null) return fresh();
  const r = tryParse(raw);
  if (r && !r.damaged) return r.value;
  preserve(store, key, raw); // keep the damaged copy, whatever happens next
  const bak = tryParse(store.getItem(key + '-bak'));
  if (bak && !bak.damaged) { notify(`Some saved ${label} was damaged - restored yer last good copy.`); return bak.value; }
  if (r) { notify(`Some saved ${label} was damaged - fixed what we could (a copy of the old save is kept).`); return r.value; }
  notify(`Couldnae restore yer saved ${label} - starting fresh (a copy of the old save is kept).`); return fresh();
}
export function saveRecord(key, value, label) {
  const store = ls(); if (!store) return false;
  try { const prev = store.getItem(key), next = JSON.stringify(value); if (prev && prev !== next) store.setItem(key + '-bak', prev); store.setItem(key, next); return true; }
  catch { if (!warnedWrite) { warnedWrite = true; notify(`Couldnae save yer ${label} on this device - progress might not be kept.`); } return false; }
}
// small validators
export const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const strArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
export const nat = (v) => Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
