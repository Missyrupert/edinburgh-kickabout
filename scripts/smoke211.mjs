import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
for (const [W, H] of [[915, 412], [800, 360], [740, 320]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:4199/?level=pilton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 });
  ok(await pg.evaluate(() => document.getElementById('verTag').textContent === 'v2.9'), `${W}x${H} label`);
  const fits = async (sel) => pg.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }, sel);
  ok(await fits('#mainPanel'), `${W}x${H} welcome fits`);
  for (const p of ['settingsBtn', 'helpBtn', 'lockerBtn']) { await pg.click('#' + p); await pg.waitForTimeout(150); const panel = p.replace('Btn', 'Panel');
    const backVis = await pg.evaluate((id) => { const bk = document.querySelector('#' + id + ' .back').getBoundingClientRect(); return bk.bottom <= innerHeight && bk.top >= 0; }, panel);
    ok(await fits('#' + panel) && backVis, `${W}x${H} ${panel} fits, Back visible`); await pg.click('#' + panel + ' .back'); }
  await pg.click('#startBtn'); await pg.waitForTimeout(500);
  await pg.evaluate(() => { __game.openCounter(); });
  await pg.waitForTimeout(900); ok(await fits('#counterCard .card'), `${W}x${H} counter card fits`);
  for (const id of ['cnt_wee', 'cnt_supper', 'cnt_munchie', 'cntClose']) ok(await pg.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= innerHeight && (e === document.getElementById(id) || document.getElementById(id).contains(e)); }, id), `${W}x${H} ${id} visible + hittable`);
  ok(await pg.evaluate(() => { const h = document.querySelector('#counterCard h1').getBoundingClientRect(); return h.top >= 0; }), `${W}x${H} counter title not clipped`);
  if (W === 800) await pg.screenshot({ path: '/workspace/ek-design/v211-counter.png' });
  await pg.click('#cntClose'); ok(await pg.evaluate(() => document.getElementById('counterCard').classList.contains('hidden')), `${W}x${H} close works`);
  await pg.evaluate(() => { document.getElementById('goalCard').classList.remove('hidden'); }); await pg.waitForTimeout(900); ok(await fits('#goalCard .card'), `${W}x${H} chippy-unlocked card fits`);
  await ctx.close();
}
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
