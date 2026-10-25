// v3.9.2: finale in both states (streets left vs all done, incl. Pilton with no tiers object), REQUIRED matches live target IDs,
// save notices wait for Play and aren't replaced by the welcome toast.
import { chromium } from 'playwright-core';
import { REQUIRED } from '../src/levels/required.js';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const URL = process.argv[2] || 'http://localhost:4199/';
const page = async (seed) => { const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript((seed) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); for (const [k, v] of Object.entries(seed || {})) localStorage.setItem(k, v); }
    window.__toasts = []; document.addEventListener('DOMContentLoaded', () => { const el = document.getElementById('toast'); new MutationObserver(() => __toasts.push([performance.now(), el.textContent])).observe(el, { childList: true, subtree: true, characterData: true }); }); }, seed);
  const pg = await ctx.newPage(); pg.on('pageerror', e => { fail++; console.log('PAGEERR', e.message); }); return pg; };
const levels = (ids) => Object.fromEntries(ids.map((id) => [id, Object.fromEntries(REQUIRED[id].map((k) => [k, true]))]));
// 1: REQUIRED vs live IDs (two samples incl. Pilton)
for (const l of ['pennywell', 'grassmarket']) { const pg = await page({}); await pg.goto(URL + `?debug&preset=low&level=${l}`); await pg.waitForFunction(() => window.__game, null, { timeout: 40000 });
  const ids = await pg.evaluate(() => __game.targets.map((t) => t.id)); ok(JSON.stringify(ids.sort()) === JSON.stringify([...REQUIRED[l]].sort()), `REQUIRED.${l} matches live targets`); await pg.close(); }
// 2: finale, all but Royal Mile done -> partial
const all = Object.keys(REQUIRED).filter((x) => x !== 'esplanade');
{ const pg = await page({ 'ek-unlocks': JSON.stringify({ levels: levels(all.filter((x) => x !== 'royalmile')) }) }); await pg.goto(URL + '?debug&preset=low&level=esplanade'); await pg.waitForFunction(() => window.__game, null, { timeout: 40000 });
  const f = await pg.evaluate(() => __game.finale()); ok(/crowned/.test(f.title) && /1 street still/.test(f.line) && f.left.join() === 'royalmile', 'finale partial: ' + f.title + ' | left=' + f.left); await pg.close(); }
// 3: every street done (Pilton ordinary targets only, no challenges) -> full journey
{ const pg = await page({ 'ek-unlocks': JSON.stringify({ levels: levels(all) }) }); await pg.goto(URL + '?debug&preset=low&level=esplanade'); await pg.waitForFunction(() => window.__game, null, { timeout: 40000 });
  const f = await pg.evaluate(() => __game.finale()); ok(f.left.length === 0 && /done it/.test(f.title) && /Every street/.test(f.line), 'finale full journey: ' + f.title); await pg.close(); }
// 4: damaged save notice waits for Play, then shows for its full time before the welcome
{ const pg = await page({ 'ek-unlocks': '{"levels":{},"balls":null}' }); await pg.goto(URL + '?debug&preset=low&level=pennywell'); await pg.waitForFunction(() => window.__game, null, { timeout: 40000 });
  await pg.waitForTimeout(4000); const before = await pg.evaluate(() => __toasts.filter(([, t]) => /damaged/.test(t)).length); ok(before === 0, 'no save notice behind the menu');
  await pg.click('#startBtn'); await pg.waitForTimeout(12000);
  const t = await pg.evaluate(() => __toasts.filter(([, x]) => x)); const ni = t.findIndex(([, x]) => /damaged/.test(x)), wi = t.findIndex(([, x]) => /Welcome|Pennywell/i.test(x));
  ok(ni >= 0 && /copy of the old save is kept/.test(t[ni][1]), 'notice shown after Play with accurate copy wording');
  ok(wi > ni && t[wi][0] - t[ni][0] >= 5500, `welcome waits for the notice (${wi > ni ? Math.round(t[wi][0] - t[ni][0]) : 'n/a'} ms)`); await pg.close(); }
// 5: copying the damaged save fails -> honest wording, damaged original never overwritten
{ const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('ek-wallet', 'nonsense{'); }
    const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/-corrupt-/.test(k)) throw new Error('quota'); return set.call(this, k, v); }; });
  const pg = await ctx.newPage(); await pg.goto(URL + '?debug&preset=low&level=pennywell'); await pg.waitForFunction(() => window.__game, null, { timeout: 40000 });
  await pg.click('#startBtn'); await pg.waitForTimeout(3000);
  const n = await pg.evaluate(() => (window.__ekNotices || []).join(' | ')); ok(/couldnae copy the old save/.test(n) && !/copy of the old save is kept/.test(n), 'preserve failure worded honestly: ' + n.slice(0, 90));
  await pg.evaluate(() => { try { __game.wallet && (__game.wallet.pence += 0); } catch {} }); await pg.waitForTimeout(1000);
  ok(await pg.evaluate(() => localStorage.getItem('ek-wallet')) === 'nonsense{', 'damaged original left untouched'); await ctx.close(); }
await b.close(); console.log(fail ? `FAILED ${fail}` : 'ALL OK'); process.exit(fail ? 1 : 0);
