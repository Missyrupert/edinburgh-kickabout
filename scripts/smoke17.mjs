import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const errs = [];
for (const lv of ['pilton','grassmarket']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(lv+': '+e.message)); pg.on('console', m => m.type()==='error' && errs.push(lv+': '+m.text()));
  await pg.goto(`http://localhost:4199/?debug&level=${lv}&preset=low`); await pg.waitForFunction(() => window.__game, null, { timeout: 30000 });
  if (lv==='pilton') { await pg.click('#helpBtn'); await pg.screenshot({ path: `screenshots/v17-help-phone.png` }); await pg.evaluate(() => __game.showPanel('mainPanel')); }
  await pg.click('#startBtn'); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => { const g = __game; g.fetchBall(); const i = g.trapped.indexOf(true); g.aim(g.yaw + 2, -0.3); g.simulate(0.1); return { chal: document.getElementById('chalVal').textContent, wallet: document.getElementById('wallet').innerText.split('\n')[0], trapped: g.trapped, kickedAfterTurn: g.kick(0.5) }; });
  console.log(lv, JSON.stringify(r));
  await pg.screenshot({ path: `screenshots/v17-${lv}-phone.png` }); await ctx.close();
}
console.log('errors', JSON.stringify(errs)); await b.close();
