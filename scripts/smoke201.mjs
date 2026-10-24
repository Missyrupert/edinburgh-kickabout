import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = []; let fail = 0; const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fail++; };
const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true });
const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type() === 'error' && errs.push(m.text()));
const open = async () => { await pg.goto('http://localhost:4199/?level=pilton&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 }); await pg.click('#startBtn'); await pg.waitForTimeout(800); };
await open();
// simulate an old v2.0 save: £6.30 carried over, no targets done
await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('ek-wallet', JSON.stringify({ pence: 630, goalSeen: false, suppers: 0, total: 900 })); localStorage.setItem('ek-level', 'pilton'); });
await open();
ok(await pg.evaluate(async () => (await (await fetch('version.json', { cache: 'no-store' })).json()).v === document.getElementById('verTag').textContent), 'label matches version.json');
const w0 = await pg.evaluate(() => __game.wallet.pence); ok(w0 <= 200, 'old wallet capped: ' + w0);
const ids = await pg.evaluate(() => __game.targets.map(t => t.id)); console.log(ids);
const card = () => pg.evaluate(() => !document.getElementById('goalCard').classList.contains('hidden'));
for (let i = 0; i < ids.length; i++) {
  await pg.evaluate((id) => __game.scoreTarget(__game.targets.find(t => t.id === id)), ids[i]); await pg.waitForTimeout(2200);
  const c = await card(), w = await pg.evaluate(() => __game.wallet.pence); console.log(i + 1, ids[i], w, c);
  if (i < 6) ok(!c, `no chippy after ${i + 1} targets`);
  if (i === 6) ok(c, 'chippy unlocks at 7/8');
  if (c) await pg.click('#goalOk');
}
await pg.reload(); await pg.waitForFunction(() => window.__game); ok(await pg.evaluate(() => __game.wallet.pence) > 600, 'migration runs once (money kept after reload)');
console.log('errors', JSON.stringify(errs)); await b.close(); process.exit(fail || errs.length ? 1 : 0);
