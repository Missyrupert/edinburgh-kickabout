// v3.9.1: save robustness (malformed + backup restore, damaged copies kept, notices), ?debug gating, replay scoring without repeat pay,
// reset progress clears the live targets/score, and the honest finale wording.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const ctxFor = async (seed) => { const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript((seed) => { if (seed && !sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }
    window.__toasts = []; document.addEventListener('DOMContentLoaded', () => { const el = document.getElementById('toast'); new MutationObserver(() => __toasts.push(el.innerHTML)).observe(el, { childList: true, subtree: true, characterData: true }); }); }, seed);
  const pg = await ctx.newPage(); pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('dialog', d => d.accept()); return pg; };
// A: no ?debug -> no test hook
{ const pg = await ctxFor(null); await pg.goto(URL + '?level=pennywell&preset=low'); await pg.waitForTimeout(4000); ok(await pg.evaluate(() => window.__game === undefined), 'no window.__game without ?debug'); await pg.close(); }
// B1: malformed saves
{ const pg = await ctxFor({ 'ek-unlocks': '{"levels":{},"balls":null}', 'ek-wallet': 'nonsense{', 'ek-wallet-v': '2' });
  await pg.goto(URL + '?debug&level=pennywell&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(7000);
  const r = await pg.evaluate(() => ({ u: __game.unlocks, w: __game.wallet, keys: Object.keys(localStorage), toasts: __toasts }));
  ok(r.u.balls.includes('tango') && r.u.ball === 'tango' && typeof r.u.levels === 'object', 'malformed ek-unlocks {"levels":{},"balls":null} recovers to defaults ' + JSON.stringify(r.u.balls));
  ok(r.w.pence === 0, 'nonsense ek-wallet recovers to £0');
  ok(r.keys.some(k => k.startsWith('ek-unlocks-corrupt-')) && r.keys.some(k => k.startsWith('ek-wallet-corrupt-')), 'damaged copies kept ' + r.keys.filter(k => k.includes('corrupt')).join(','));
  ok(r.toasts.some(t => /damaged|Couldnae restore/.test(t)), 'player told about the damaged save');
  await pg.close(); }
// B2: corrupt main save, valid backup -> restored
{ const pg = await ctxFor({ 'ek-unlocks': '{{oops', 'ek-unlocks-bak': JSON.stringify({ levels: { pennywell: { oldpump: true } }, balls: ['tango'] }), 'ek-wallet-v': '2' });
  await pg.goto(URL + '?debug&level=pennywell&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(6000);
  const r = await pg.evaluate(() => ({ lv: __game.unlocks.levels.pennywell, done: __game.targets.find(t => t.id === 'oldpump').done, toasts: __toasts }));
  ok(r.lv && r.lv.oldpump === true && r.done, 'corrupt save restored from the last good backup (target still bagged)');
  ok(r.toasts.some(t => /last good copy/.test(t)), 'player told the backup was used');
  await pg.close(); }
// C/D: replay scores without repeat pay; reset clears live state
{ const pg = await ctxFor({ 'ek-wallet-v': '2' });
  await pg.goto(URL + '?debug&level=pennywell&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(1500);
const kickAll = (only) => pg.evaluate((only) => { const g = __game, res = {}; for (const t of g.targets) { if (only && !only.includes(t.id)) continue; let n = 0;
  for (const pitch of (t.aim.y - (t.stand.y || 0) > 2.5 ? [0.25, 0.35, 0.12, 0.5, 0.0] : [0.0, 0.12, -0.15, 0.25, -0.3, 0.35, -0.45, 0.5])) for (const p of [0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) { if (t.done) break; g.teleport(t.stand.x, t.stand.z, 0, -15, (t.stand.y || 0) + 0.47); g.simulate(0.3); const P = g.player.position; const dx = t.aim.x - P.x, dz = t.aim.z - P.z; const y = Math.atan2(-dx, -dz); g.aim(y, pitch);
    g.placeBall(0, P.x - Math.sin(y) * 0.8, P.y - 0.2, P.z - Math.cos(y) * 0.8); g.simulate(0.2); g.kick(p); g.simulate(4); n++; } res[t.id] = t.done ? n : 0; } return res; }, only);
  const k1 = await kickAll(['oldpump']); const s1 = await pg.evaluate(() => ({ score: __game.score, pence: __game.wallet.pence }));
  ok(k1.oldpump > 0 && s1.score > 0 && s1.pence > 0, 'first clear scores and pays ' + JSON.stringify(s1));
  await pg.evaluate(() => __game.pause()); await pg.click('#restartBtn'); await pg.waitForTimeout(500);
  const s2 = await pg.evaluate(() => ({ score: __game.score, done: __game.targets.find(t => t.id === 'oldpump').done }));
  ok(s2.score === 0 && !s2.done, 'Replay this level resets the targets and score ' + JSON.stringify(s2));
  const k2 = await kickAll(['oldpump']); const s3 = await pg.evaluate(() => ({ score: __game.score, pence: __game.wallet.pence }));
  ok(k2.oldpump > 0 && s3.score > 0 && s3.pence === s1.pence, 'replayed target scores again but pays nothing ' + JSON.stringify(s3));
  await pg.evaluate(() => document.getElementById('progressReset').click()); await pg.waitForTimeout(500);
  const s4 = await pg.evaluate(() => ({ score: __game.score, done: __game.targets.filter(t => t.done).length, pence: __game.wallet.pence, boots: __game.unlocks.boots }));
  ok(s4.score === 0 && s4.done === 0 && s4.pence === 0 && s4.boots === 'trainers', 'Reset progress clears live targets, score, wallet and boots ' + JSON.stringify(s4));
  await pg.close(); }
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
