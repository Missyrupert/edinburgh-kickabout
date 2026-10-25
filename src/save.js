// v3.9.1: safe saves. Every record is validated + sanitised on load; a damaged record is never thrown away - it is kept under
// '<key>-corrupt-<timestamp>' and the last good copy ('<key>-bak') is used if it is valid. Problems are queued as short,
// non-blocking notices for the HUD (shown once the game is up). Storage failures (private mode, quota) are reported once.
export const notices = [];
let listener = null, warnedWrite = false; const trusted = new Set(); // keys whose stored value we know is good (safe to copy to -bak)
export function onNotice(fn) { listener = fn; while (notices.length) fn(notices.shift()); }
function notify(msg) { if (listener) listener(msg); else notices.push(msg); }
const ls = () => { try { return window.localStorage; } catch { return null; } };
const locked = new Set(); // v3.9.2: keys whose damaged original couldn't be copied - never overwrite them this session
function preserve(store, key, raw) { const k = `${key}-corrupt-${Date.now()}`; try { store.setItem(k, raw); return store.getItem(k) === raw; } catch { return false; } }
// sanitise(parsed) -> { value, damaged } or null if unusable
export function loadRecord(key, sanitise, fresh, label) {
  const store = ls(); if (!store) { notify(`Saves are switched off on this browser - ${label} won't be kept.`); return fresh(); }
  let raw = null; try { raw = store.getItem(key); } catch { notify(`Couldnae read yer saved ${label}.`); return fresh(); }
  const tryParse = (s) => { if (s == null) return null; try { return sanitise(JSON.parse(s)); } catch { return null; } };
  if (raw == null) { trusted.add(key); return fresh(); }
  const r = tryParse(raw);
  if (r && !r.damaged) { trusted.add(key); return r.value; }
  const kept = preserve(store, key, raw); // keep the damaged copy, whatever happens next
  if (!kept) locked.add(key); // couldn't copy it: leave the damaged original untouched rather than lose it
  const note = kept ? ' (a copy of the old save is kept)' : " (couldnae copy the old save, so it's left as it was and new progress won't be saved this time)";
  let bakRaw = null; try { bakRaw = store.getItem(key + '-bak'); } catch {}
  const bak = tryParse(bakRaw);
  if (bak && !bak.damaged) { notify(`Some saved ${label} was damaged - restored yer last good copy${note}.`); return bak.value; }
  if (r) { notify(`Some saved ${label} was damaged - fixed what we could${note}.`); return r.value; }
  notify(`Couldnae restore yer saved ${label} - starting fresh${note}.`); return fresh();
}
export function saveRecord(key, value, label) {
  const store = ls(); if (!store || locked.has(key)) return false;
  try { const prev = store.getItem(key), next = JSON.stringify(value); if (prev && prev !== next && trusted.has(key)) store.setItem(key + '-bak', prev); store.setItem(key, next); trusted.add(key); return true; }
  catch { if (!warnedWrite) { warnedWrite = true; notify(`Couldnae save yer ${label} on this device - progress might not be kept.`); } return false; }
}
// small validators
export const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const strArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
export const nat = (v) => Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
