import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage(); pg.on('pageerror', e => console.log('PAGEERR', e.message));
const URL = process.argv[2] || 'http://localhost:4199/', D = process.argv[3] || '/tmp/s26-';
await pg.goto(URL + '?level=grassmarket&preset=low'); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(2500);
await pg.evaluate(() => document.getElementById('toast').style.display = 'none');
for (const [n, v] of [['castle-compare', [8, -19, 175, 22]], ['square-compare', [55, -12, 100, 3]], ['victoria-compare', [-57.5, 21, 172, 10]], ['spawn', [3, -10, 180, -4]], ['east', [-30, 0, 90, 2]], ['close', [30, -14, 0, 0]], ['backcourt', [30, -36, 0, 4]], ['cafe', [10, 2, 120, -6]]]) {
  await pg.evaluate((v) => __game.teleport(...v), v); await pg.waitForTimeout(1500); await pg.screenshot({ path: D + n + '.png' }); }
await b.close();
