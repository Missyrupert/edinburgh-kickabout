import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg = await (await b.newContext({ viewport: { width: 915, height: 412 }, hasTouch: true, isMobile: true })).newPage(); const errs = []; pg.on('pageerror', e => { errs.push(e.message); console.log('PAGEERR', e.message); }); pg.on('console', m => { if (/atlas full/.test(m.text())) errs.push(m.text()); });
const URL = process.argv[2] || 'http://localhost:4199/', D = process.argv[3] || '/tmp/s27-', Q = process.argv[4] || 'low';
const SH = { grassmarket: [['castle', [8, -19, 175, 24]], ['square', [55, -12, 100, 3]], ['victoria', [-57.5, 21, 172, 10]], ['memorial', [-44, -6, 60, -25]], ['pub', [-35, 14, 200, -2]], ['phonebox', [-45.5, 17.6, 200, -6]], ['spawn', [3, -10, 180, -4]]],
  pilton: [['flats', [-2, -30, 225, 2]], ['parade', [0, 16, 180, 6]], ['island', [2, -36, 20, -10]], ['spawn', [0, -38, 180, -8]]] };
for (const lv of ['grassmarket', 'pilton']) { await pg.goto(URL + `?debug&level=${lv}&preset=${Q}`); await pg.waitForFunction(() => window.__game, null, { timeout: 60000 }); await pg.click('#startBtn'); await pg.waitForTimeout(2500);
  await pg.evaluate(() => document.getElementById('toast').style.display = 'none');
  for (const [n, v] of SH[lv]) { await pg.evaluate((v) => __game.teleport(...v), v); await pg.waitForTimeout(1500); await pg.screenshot({ path: `${D}${lv}-${n}.png` }); } }
console.log('errors', JSON.stringify(errs)); await b.close();
